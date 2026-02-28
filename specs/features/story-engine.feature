Feature: Story Conversation Engine — AI-Powered Conversations
  As a user of OmasApp
  I want to have real AI-powered conversations with the KI-Begleiterin
  So that Oma's stories are captured with warmth and follow-up questions

  Background:
    Given the API server is running

  # AC 1: AI-generated welcome
  Scenario: First session gets an open-ended welcome
    When I create a new session via POST "/api/stories/sessions"
    Then the response status should be 201
    And the response body should contain a "session" object with status "active"
    And the response body should contain a "welcomeMessage" string
    And the welcome message should be a warm German greeting

  Scenario: Returning user gets context-aware welcome
    Given a previous session exists with summary "Oma erzählte vom Garten in Heidelberg"
    When I create a new session via POST "/api/stories/sessions"
    Then the welcome message should reference details from prior sessions

  # AC 2: AI-powered conversation turns
  Scenario: Sending a message returns an AI follow-up
    Given an active session exists
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message                                      |
      | Ich erinnere mich an den Apfelbaum im Garten |
    Then the response status should be 200
    And the response body should contain "userMessage" with the original content
    And the response body should contain "assistantMessage" with a warm follow-up question

  # AC 3: Session ending with summary
  Scenario: Ending a session generates a summary
    Given an active session with at least one message exchange
    When I send a POST request to "/api/stories/sessions/:id/end"
    Then the response status should be 200
    And the session status should be "ended"
    And the session should have an "endedAt" timestamp
    And the session should have a 2-3 sentence German summary

  # AC 4: Cannot end an already-ended session
  Scenario: Ending an already-ended session returns 409
    Given a session that has already been ended
    When I send a POST request to "/api/stories/sessions/:id/end"
    Then the response status should be 409
    And the response body should contain "error" with value "Session is already ended"

  # AC 5: Session list with pagination
  Scenario: Listing sessions with pagination
    Given 5 sessions have been created
    When I send a GET request to "/api/stories/sessions?limit=2&offset=0"
    Then the response status should be 200
    And the response should contain 2 sessions
    And the total should be 5
    And sessions should be sorted by startedAt descending

  Scenario: Empty session list
    When I send a GET request to "/api/stories/sessions"
    Then the response status should be 200
    And the response should contain 0 sessions
    And the total should be 0

  # AC 6: Get single session
  Scenario: Getting a single session by ID
    Given an active session exists
    When I send a GET request to "/api/stories/sessions/:id"
    Then the response status should be 200
    And the response should contain the session object

  Scenario: Getting a non-existent session returns 404
    When I send a GET request to "/api/stories/sessions/nonexistent"
    Then the response status should be 404
    And the response body should contain "error" with value "Session not found"

  # AC 7: Get session messages
  Scenario: Getting messages for a session
    Given an active session with messages
    When I send a GET request to "/api/stories/sessions/:id/messages"
    Then the response status should be 200
    And the response should contain messages sorted by timestamp ascending

  Scenario: Getting messages for non-existent session returns 404
    When I send a GET request to "/api/stories/sessions/nonexistent/messages"
    Then the response status should be 404
    And the response body should contain "error" with value "Session not found"

  # AC 8: Message length validation
  Scenario: Message exceeding 10000 characters is rejected
    Given an active session exists
    When I send a message with more than 10000 characters
    Then the response status should be 400
    And the response body should contain "error" with value "Message must not exceed 10000 characters"

  # AC 9: AI service unavailable
  Scenario: Azure OpenAI failure returns 503 for messages
    Given an active session exists
    And the Azure OpenAI service is unavailable
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message |
      | Hallo   |
    Then the response status should be 503
    And the response body should contain "error" with value "AI service is currently unavailable. Please try again."

  # AC 10: Message validation
  Scenario: Empty message is rejected
    Given an active session exists
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message |
      |         |
    Then the response status should be 400
    And the response body should contain "error" with value "Message is required"

  # AC 11: Cannot send messages to ended session
  Scenario: Sending a message to an ended session returns 409
    Given a session that has already been ended
    When I send a POST request to "/api/stories/sessions/:id/messages" with body:
      | message            |
      | Noch eine Geschichte |
    Then the response status should be 409
    And the response body should contain "error" with value "Cannot send messages to an ended session"

  # AC 12: Retry logic and timeout
  Scenario: AI calls include retry logic
    Given the Azure OpenAI service fails intermittently
    When a conversation turn is processed
    Then the system should retry up to 3 times with exponential backoff
    And requests should timeout after 30 seconds

  # AC 13: Last session summary shown on main page
  Scenario: Main page shows last session summary when no active session
    Given a previous ended session exists with a summary
    When I open the main conversation page
    Then I should see the summary of the last session
    And I should see the "Gespräch starten" button

  # Frontend scenarios
  Scenario: Starting a conversation shows AI welcome
    When I open the main conversation page
    And I click "Gespräch starten"
    Then I should see an AI-generated welcome message in the chat

  Scenario: Ending a conversation shows summary
    Given I have an active conversation
    When I click "Gespräch beenden"
    Then the session should end
    And I should see the session summary

  Scenario: AI error shows retry banner
    Given I have an active conversation
    And the AI service fails
    When I send a message
    Then I should see an error banner
    And the banner should have a retry button
