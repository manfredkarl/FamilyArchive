Feature: Walking Skeleton — End-to-End Architecture Proof
  As a user of OmasApp
  I want the basic architecture to work end-to-end
  So that conversation features can be built on a solid foundation

  # AC 1: Health endpoint
  Scenario: Health endpoint returns ok
    Given the API server is running
    When I send a GET request to "/api/health"
    Then the response status should be 200
    And the response body should contain "status" with value "ok"

  # AC 2: Session creation
  Scenario: Creating a new story session
    Given the API server is running
    When I send a POST request to "/api/stories/sessions"
    Then the response status should be 201
    And the response body should contain a "session" object with "id", "startedAt", and "status" equal to "active"
    And the response body should contain a "welcomeMessage" string

  # AC 3: Sending a message and receiving echo
  Scenario: Sending a message returns echo response
    Given the API server is running
    And a story session exists
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message |
      | Hello   |
    Then the response status should be 200
    And the response body should contain "userMessage" with "content" equal to "Hello"
    And the response body should contain "assistantMessage" with "content" containing "Echo: Hello"

  # AC 4: Empty message validation
  Scenario: Sending an empty message returns 400
    Given the API server is running
    And a story session exists
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message |
      |         |
    Then the response status should be 400
    And the response body should contain "error" with value "Message is required"

  # AC 5: Non-existent session returns 404
  Scenario: Sending a message to a non-existent session returns 404
    Given the API server is running
    When I send a POST request to "/api/stories/sessions/nonexistent/messages" with body:
      | message |
      | Hello   |
    Then the response status should be 404
    And the response body should contain "error" with value "Session not found"

  # AC 6: Frontend loads with NavBar
  Scenario: Frontend loads and displays NavBar
    When I open the app at "/"
    Then the page should load without errors
    And I should see the NavBar with text "Omas Geschichten 💛"

  # AC 7: Start conversation shows welcome
  Scenario: Starting a conversation shows welcome message
    Given I am on the main page
    When I click "Gespräch starten"
    Then a new session should be created
    And a welcome message should appear in the chat

  # AC 8: Sending a message shows echo
  Scenario: Typing a message shows user message and echo response
    Given I am on the main page
    And I have started a conversation
    When I type "Hallo Oma" and press Enter
    Then I should see my message "Hallo Oma" in the chat
    And I should see an echo response containing "Echo: Hallo Oma"

  # AC 9: Navigation links to placeholder pages
  Scenario: Nav links lead to placeholder pages
    When I open the app at "/"
    Then the NavBar should contain a link to "/history"
    And the NavBar should contain a link to "/ask"
    And the NavBar should contain a link to "/timeline"

  Scenario: History placeholder page
    When I navigate to "/history"
    Then I should see "Kommt bald"

  Scenario: Ask placeholder page
    When I navigate to "/ask"
    Then I should see "Kommt bald"

  Scenario: Timeline placeholder page
    When I navigate to "/timeline"
    Then I should see "Kommt bald"

  # AC 10: App builds without errors
  Scenario: App builds successfully
    When I run "npm run build" in the API directory
    Then the build should complete without errors
    When I run "npm run build" in the Web directory
    Then the build should complete without errors

  # AC 11: Accessibility requirements
  Scenario: Accessibility basics are met
    When I open the app at "/"
    Then the HTML root element should have lang="de"
    And the body font size should be at least 18px
    And all interactive elements should have a minimum size of 48x48 pixels
