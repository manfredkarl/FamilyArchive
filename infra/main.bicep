targetScope = 'subscription'
// targetScope = 'resourceGroup'

@minLength(1)
@maxLength(64)
@description('Name of the environment that can be used as part of naming resource convention')
param environmentName string

@minLength(1)
@maxLength(90)
@description('Name of the resource group to use or create')
param resourceGroupName string = 'rg-${environmentName}'

// Restricted locations to match list from
// https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key#region-availability
@minLength(1)
@description('Primary location for all resources')
@allowed([
  'australiaeast'
  'brazilsouth'
  'canadacentral'
  'canadaeast'
  'eastus'
  'eastus2'
  'francecentral'
  'germanywestcentral'
  'italynorth'
  'japaneast'
  'koreacentral'
  'northcentralus'
  'norwayeast'
  'polandcentral'
  'southafricanorth'
  'southcentralus'
  'southeastasia'
  'southindia'
  'spaincentral'
  'swedencentral'
  'switzerlandnorth'
  'uaenorth'
  'uksouth'
  'westus'
  'westus2'
  'westus3'
])
param location string

@metadata({azd: {
  type: 'location'
  usageName: [
    'OpenAI.GlobalStandard.gpt-4o-mini,10'
  ]}
})
param aiDeploymentsLocation string

@description('Id of the user or app to assign application roles')
param principalId string

@description('Principal type of user or app')
param principalType string

@description('Optional. Name of an existing AI Services account within the resource group. If not provided, a new one will be created.')
param aiFoundryResourceName string = ''

@description('Optional. Name of the AI Foundry project. If not provided, a default name will be used.')
param aiFoundryProjectName string = 'ai-project-${environmentName}'

@description('List of model deployments')
param aiProjectDeploymentsJson string = '[]'

@description('List of connections')
param aiProjectConnectionsJson string = '[]'

@description('List of resources to create and connect to the AI project')
param aiProjectDependentResourcesJson string = '[]'

var aiProjectDeployments = json(aiProjectDeploymentsJson)
var aiProjectConnections = json(aiProjectConnectionsJson)
var aiProjectDependentResources = json(aiProjectDependentResourcesJson)

@description('Enable hosted agent deployment')
param enableHostedAgents bool

@description('Enable monitoring for the AI project')
param enableMonitoring bool = true

// Tags that should be applied to all resources.
// 
// Note that 'azd-service-name' tags should be applied separately to service host resources.
// Example usage:
//   tags: union(tags, { 'azd-service-name': <service name in azure.yaml> })
var tags = {
  'azd-env-name': environmentName
}

// Check if resource group exists and create it if it doesn't
resource rg 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// Build dependent resources array conditionally
// Check if ACR already exists in the user-provided array to avoid duplicates
var hasAcr = contains(map(aiProjectDependentResources, r => r.resource), 'registry')
var dependentResources = (enableHostedAgents) && !hasAcr ? union(aiProjectDependentResources, [
  {
    resource: 'registry'
    connectionName: 'acr-connection'
  }
]) : aiProjectDependentResources

// AI Project module
module aiProject 'core/ai/ai-project.bicep' = {
  scope: rg
  name: 'ai-project'
  params: {
    tags: tags
    location: aiDeploymentsLocation
    aiFoundryProjectName: aiFoundryProjectName
    principalId: principalId
    principalType: principalType
    existingAiAccountName: aiFoundryResourceName
    deployments: aiProjectDeployments
    connections: aiProjectConnections
    additionalDependentResources: dependentResources
    enableMonitoring: enableMonitoring
    enableHostedAgents: enableHostedAgents
  }
}

// spec2cloud additional resources and connections
// reused from https://github.com/Azure-Samples/todo-python-mongo-aca/blob/main/infra/main.bicep


param apiContainerAppName string = ''
param containerAppsEnvironmentName string = ''
param containerRegistryName string = ''
param webContainerAppName string = ''
param apimServiceName string = ''
param webAppExists bool = false
param apiAppExists bool = false
@description('Flag to use Azure API Management to mediate the calls between the Web frontend and the backend API')
param useAPIM bool = false

@description('API Management SKU to use if APIM is enabled')
param apimSku string = 'Consumption'

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var apiContainerAppNameOrDefault = '${abbrs.appContainerApps}web-${resourceToken}'
var corsAcaUrl = 'https://${apiContainerAppNameOrDefault}.${containerApps.outputs.defaultDomain}'

// Container apps host (including container registry)
module containerApps 'br/public:avm/ptn/azd/container-apps-stack:0.1.0' = {
  name: 'container-apps'
  scope: rg
  params: {
    containerAppsEnvironmentName: !empty(containerAppsEnvironmentName) ? containerAppsEnvironmentName : '${abbrs.appManagedEnvironments}${resourceToken}'
    containerRegistryName: !empty(containerRegistryName) ? containerRegistryName : '${abbrs.containerRegistryRegistries}${resourceToken}'
    logAnalyticsWorkspaceResourceId: aiProject.outputs.logAnalyticsWorkspaceId
    appInsightsConnectionString: aiProject.outputs.APPLICATIONINSIGHTS_CONNECTION_STRING
    acrSku: 'Basic'
    location: location
    acrAdminUserEnabled: true
    zoneRedundant: false
    tags: tags
  }
}

//the managed identity for web frontend
module webIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.2.1' = {
  name: 'webidentity'
  scope: rg
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}web-${resourceToken}'
    location: location
  }
}

// Web frontend
module web 'br/public:avm/ptn/azd/container-app-upsert:0.1.1' = {
  name: 'web-container-app'
  scope: rg
  params: {
    name: !empty(webContainerAppName) ? webContainerAppName : '${abbrs.appContainerApps}web-${resourceToken}'
    tags: union(tags, { 'azd-service-name': 'web' })
    location: location
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    ingressEnabled: true
    identityType: 'UserAssigned'
    exists: webAppExists
    containerName: 'main'
    identityName: webIdentity.name
    userAssignedIdentityResourceId: webIdentity.outputs.resourceId
    containerMinReplicas: 1
    identityPrincipalId: webIdentity.outputs.principalId
  }
}

//the managed identity for api backend
module apiIdentity 'br/public:avm/res/managed-identity/user-assigned-identity:0.2.1' = {
  name: 'apiidentity'
  scope: rg
  params: {
    name: '${abbrs.managedIdentityUserAssignedIdentities}api-${resourceToken}'
    location: location
  }
}

// Api backend
module api 'br/public:avm/ptn/azd/container-app-upsert:0.1.1' = {
  name: 'api-container-app'
  scope: rg
  params: {
    name: !empty(apiContainerAppName) ? apiContainerAppName : '${abbrs.appContainerApps}api-${resourceToken}'
    tags: union(tags, { 'azd-service-name': 'api' })
    location: location
    env: [
      {
        name: 'AZURE_CLIENT_ID'
        value: apiIdentity.outputs.clientId
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: aiProject.outputs.APPLICATIONINSIGHTS_CONNECTION_STRING
      }
      {
        name: 'API_ALLOW_ORIGINS'
        value: corsAcaUrl
      }
    ]
    containerAppsEnvironmentName: containerApps.outputs.environmentName
    containerRegistryName: containerApps.outputs.registryName
    exists: apiAppExists
    identityType: 'UserAssigned'
    identityName: apiIdentity.name
    containerCpuCoreCount: '1.0'
    containerMemory: '2.0Gi'
    targetPort: 8080
    containerMinReplicas: 1
    ingressEnabled: true
    containerName: 'main'
    userAssignedIdentityResourceId: apiIdentity.outputs.resourceId
    identityPrincipalId: apiIdentity.outputs.principalId
  }
}

// Creates Azure API Management (APIM) service to mediate the requests between the frontend and the backend API
module apim 'br/public:avm/res/api-management/service:0.2.0' = if (useAPIM) {
  name: 'apim-deployment'
  scope: rg
  params: {
    name: !empty(apimServiceName) ? apimServiceName : '${abbrs.apiManagementService}${resourceToken}'
    publisherEmail: 'noreply@microsoft.com'
    publisherName: 'n/a'
    location: location
    tags: tags
    sku: apimSku
    skuCount: 0
    zones: []
    customProperties: {}
    loggers: [
      {
        name: 'app-insights-logger'
        credentials: {
          instrumentationKey: aiProject.outputs.applicationInsightsInstrumentationKey
        }
        loggerDescription: 'Logger to Azure Application Insights'
        isBuffered: false
        loggerType: 'applicationInsights'
        targetResourceId: aiProject.outputs.applicationInsightsResourceId
      }
    ]
  }
}

//Configures the API settings for an api app within the Azure API Management (APIM) service.
module apimApi 'br/public:avm/ptn/azd/apim-api:0.1.0' = if (useAPIM) {
  name: 'apim-api-deployment'
  scope: rg
  params: {
    apiBackendUrl: api.outputs.uri
    apiDescription: 'This is a simple Todo API'
    apiDisplayName: 'Simple Todo API'
    apiName: 'todo-api'
    apiPath: 'todo'
    name: useAPIM ? apim.outputs.name : ''
    webFrontendUrl: web.outputs.uri
    location: location
  }
}


// App outputs
output API_CORS_ACA_URL string = corsAcaUrl
output APPLICATIONINSIGHTS_NAME string = aiProject.outputs.applicationInsightsName
output AZURE_CONTAINER_ENVIRONMENT_NAME string = containerApps.outputs.environmentName
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = containerApps.outputs.registryLoginServer
output AZURE_CONTAINER_REGISTRY_NAME string = containerApps.outputs.registryName
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output API_BASE_URL string = useAPIM ? apimApi.outputs.serviceApiUri : api.outputs.uri
output REACT_APP_WEB_BASE_URL string = web.outputs.uri
output SERVICE_API_NAME string = api.outputs.name
output SERVICE_WEB_NAME string = web.outputs.name
output USE_APIM bool = useAPIM
output SERVICE_API_ENDPOINTS array = useAPIM ? [ apimApi.outputs.serviceApiUri, api.outputs.uri ] : []



// Resources
output AZURE_RESOURCE_GROUP string = resourceGroupName
output AZURE_AI_ACCOUNT_ID string = aiProject.outputs.accountId
output AZURE_AI_PROJECT_ID string = aiProject.outputs.projectId
output AZURE_AI_FOUNDRY_PROJECT_ID string = aiProject.outputs.projectId
output AZURE_AI_ACCOUNT_NAME string = aiProject.outputs.aiServicesAccountName
output AZURE_AI_PROJECT_NAME string = aiProject.outputs.projectName

// Endpoints
output AZURE_AI_PROJECT_ENDPOINT string = aiProject.outputs.AZURE_AI_PROJECT_ENDPOINT
output AZURE_OPENAI_ENDPOINT string = aiProject.outputs.AZURE_OPENAI_ENDPOINT
output APPLICATIONINSIGHTS_CONNECTION_STRING string = aiProject.outputs.APPLICATIONINSIGHTS_CONNECTION_STRING

// Dependent Resources and Connections

// ACR
output AZURE_AI_PROJECT_ACR_CONNECTION_NAME string = aiProject.outputs.dependentResources.registry.connectionName

// Bing Search
output BING_GROUNDING_CONNECTION_NAME  string = aiProject.outputs.dependentResources.bing_grounding.connectionName
output BING_GROUNDING_RESOURCE_NAME string = aiProject.outputs.dependentResources.bing_grounding.name
output BING_GROUNDING_CONNECTION_ID string = aiProject.outputs.dependentResources.bing_grounding.connectionId

// Bing Custom Search
output BING_CUSTOM_GROUNDING_CONNECTION_NAME string = aiProject.outputs.dependentResources.bing_custom_grounding.connectionName
output BING_CUSTOM_GROUNDING_NAME string = aiProject.outputs.dependentResources.bing_custom_grounding.name
output BING_CUSTOM_GROUNDING_CONNECTION_ID string = aiProject.outputs.dependentResources.bing_custom_grounding.connectionId

// Azure AI Search
output AZURE_AI_SEARCH_CONNECTION_NAME string = aiProject.outputs.dependentResources.search.connectionName
output AZURE_AI_SEARCH_SERVICE_NAME string = aiProject.outputs.dependentResources.search.serviceName

// Azure Storage
output AZURE_STORAGE_CONNECTION_NAME string = aiProject.outputs.dependentResources.storage.connectionName
output AZURE_STORAGE_ACCOUNT_NAME string = aiProject.outputs.dependentResources.storage.accountName

