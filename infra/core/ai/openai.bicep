@description('Name of the Azure OpenAI resource')
param name string

@description('Location for the resource')
param location string = resourceGroup().location

@description('Tags for the resource')
param tags object = {}

@description('SKU name')
param skuName string = 'S0'

@description('Model deployments')
param deployments array = [
  {
    name: 'gpt-4o'
    model: {
      format: 'OpenAI'
      name: 'gpt-4o'
      version: '2024-11-20'
    }
    sku: {
      name: 'Standard'
      capacity: 30
    }
  }
]

@description('Principal IDs to grant Cognitive Services OpenAI User role (ServicePrincipal)')
param roleAssignmentPrincipalIds array = []

@description('User principal IDs to grant Cognitive Services OpenAI User role')
param userRoleAssignmentPrincipalIds array = []

resource openai 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  tags: tags
  kind: 'OpenAI'
  sku: {
    name: skuName
  }
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      defaultAction: 'Allow'
    }
  }
}

@batchSize(1)
resource deployment 'Microsoft.CognitiveServices/accounts/deployments@2024-10-01' = [
  for d in deployments: {
    parent: openai
    name: d.name
    sku: d.sku
    properties: {
      model: d.model
      raiPolicyName: 'Microsoft.DefaultV2'
    }
  }
]

// Cognitive Services OpenAI User role
var cognitiveServicesOpenAIUserRoleId = '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd'

resource roleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for principalId in roleAssignmentPrincipalIds: {
    scope: openai
    name: guid(openai.id, principalId, cognitiveServicesOpenAIUserRoleId)
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRoleId)
      principalId: principalId
      principalType: 'ServicePrincipal'
    }
  }
]

resource userRoleAssignments 'Microsoft.Authorization/roleAssignments@2022-04-01' = [
  for principalId in userRoleAssignmentPrincipalIds: {
    scope: openai
    name: guid(openai.id, principalId, cognitiveServicesOpenAIUserRoleId, 'user')
    properties: {
      roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', cognitiveServicesOpenAIUserRoleId)
      principalId: principalId
      principalType: 'User'
    }
  }
]

output id string = openai.id
output name string = openai.name
output endpoint string = openai.properties.endpoint
output deploymentName string = deployments[0].name
