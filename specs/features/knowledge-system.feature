Feature: Knowledge System
  As a family member
  I want entities extracted from conversations and the ability to ask questions
  So that I can explore Oma's life stories structured by decades

  Background:
    Given the API is running
    And a conversation session exists

  # --- Entity Extraction ---

  Scenario: Entities are extracted after a message
    When Oma sends a message "Mein Bruder Hans ist in den Sechzigern nach München gezogen."
    Then entities should be extracted asynchronously
    And an entity "Onkel Hans" of type "person" should exist
    And an entity "München" of type "place" should exist

  Scenario: Entity extraction failure does not break conversation
    Given OpenAI entity extraction will fail
    When Oma sends a message "Mein Bruder Hans ist nach München."
    Then the conversation response is returned successfully
    And no entities are stored for that message

  Scenario: Duplicate entities are merged
    Given an entity "Onkel Hans" of type "person" exists from session 1
    When another message mentions "Onkel Hans" in session 2
    Then only one entity "Onkel Hans" of type "person" exists
    And it has source references from both sessions
    And the longer context is kept

  # --- Entity API ---

  Scenario: List entities with type filter
    Given entities of types "person", "place", "event" exist
    When I GET /api/stories/entities?type=person
    Then only person entities are returned

  Scenario: List entities with decade filter
    Given entities from decades "1960s" and "1970s" exist
    When I GET /api/stories/entities?decade=1960s
    Then only 1960s entities are returned

  Scenario: List entities with pagination
    Given 10 entities exist
    When I GET /api/stories/entities?limit=3&offset=0
    Then 3 entities are returned
    And total is 10

  # --- Entity Search ---

  Scenario: Search entities by name
    Given an entity "Onkel Hans" exists
    When I GET /api/stories/entities/search?q=Hans
    Then the entity "Onkel Hans" is returned

  Scenario: Search with missing query returns 400
    When I GET /api/stories/entities/search
    Then the response status is 400
    And the error is "Search query is required"

  # --- Coverage ---

  Scenario: Coverage shows decade status
    Given 3 entities in decade "1960s" and 1 entity in "1950s"
    When I GET /api/stories/coverage
    Then decade "1960s" has status "covered"
    And decade "1950s" has status "thin"
    And decade "1930s" has status "empty"
    And gaps include "1930s" and "1950s"

  Scenario: All decades empty when no entities exist
    When I GET /api/stories/coverage
    Then all decades have status "empty"
    And there are 10 gaps

  # --- Knowledge Query ---

  Scenario: Ask a question and receive narrative answer
    Given entities about "Onkel Hans" exist with source messages
    When I POST /api/stories/ask with question "Was weißt du über Onkel Hans?"
    Then a narrative German answer is returned
    And source references are included

  Scenario: Ask with empty question returns 400
    When I POST /api/stories/ask with question ""
    Then the response status is 400
    And the error is "Question is required"

  Scenario: Ask about unknown topic returns no-information response
    When I POST /api/stories/ask with question "Was weißt du über Tante Frieda?"
    Then the answer indicates no information is available
    And sources array is empty

  # --- Gap Detection in Conversation ---

  Scenario: Gap hints appear in conversation after 5 turns
    Given decades "1930s" and "1970s" have no entities
    When 5 messages have been exchanged in the session
    Then the AI system prompt includes gap hints
    And the hint mentions the earliest empty decade

  Scenario: Gap hints do not appear before 5 turns
    Given decades "1930s" has no entities
    When 3 messages have been exchanged in the session
    Then the AI system prompt does not include gap hints
