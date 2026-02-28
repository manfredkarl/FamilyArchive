Feature: History Browsing
  As a family member
  I want to browse past conversation sessions and read full transcripts
  So that I can revisit Oma's stories and see extracted entities

  Background:
    Given the API is running

  # --- Session List ---

  Scenario: View session list sorted by date
    Given 3 ended sessions exist with summaries
    When I visit /history
    Then I see session cards sorted newest-first
    And each card shows the date, summary preview, and message count

  Scenario: Empty state when no sessions exist
    When I visit /history
    Then I see the message "Noch keine Gespräche — starten Sie das erste!"
    And a link to "/" is displayed

  Scenario: Pagination with more than 20 sessions
    Given 25 ended sessions exist
    When I visit /history
    Then I see 20 session cards
    And a "Mehr laden" button is shown
    When I click "Mehr laden"
    Then I see 25 session cards total

  # --- Session Transcript ---

  Scenario: View full transcript for a session
    Given an ended session with messages exists
    When I navigate to /history/:id
    Then I see the session header with date, duration, and summary
    And I see the full message transcript with timestamps
    And messages show role labels

  Scenario: Entity highlights on transcript messages
    Given an ended session exists with extracted entities
    When I navigate to /history/:id
    Then entity chips appear alongside source messages
    And person entities are blue
    And place entities are green
    And year entities are amber
    And event entities are purple
    And a color legend is displayed

  Scenario: Non-existent session shows 404 state
    When I navigate to /history/nonexistent
    Then I see "Gespräch nicht gefunden."
    And a link back to /history is displayed

  Scenario: Back navigation from transcript to history
    Given I am viewing a session transcript at /history/:id
    When I click "← Zurück zum Verlauf"
    Then I navigate to /history

  # --- Integration with Knowledge Queries ---

  Scenario: Source links from ask page resolve to transcript
    Given a knowledge query returned sources with session IDs
    When I click a source reference link on /ask
    Then I navigate to /history/:id for that session
    And the transcript is displayed correctly
