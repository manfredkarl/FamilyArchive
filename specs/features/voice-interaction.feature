Feature: Voice Interaction — Hands-free Voice Conversations
  As a user of OmasApp
  I want to talk to the KI-Begleiterin using my voice
  So that Oma can have hands-free conversations without needing to type

  Background:
    Given the app is open at "/"
    And a session is active

  # AC 1: Mic permission request
  Scenario: Clicking the microphone button requests browser permission
    When I click the microphone button
    Then the browser should request microphone permission
    And on permission granted the voice state transitions to "listening"

  # AC 2: Permission denied shows modal with German instructions
  Scenario: Mic permission denied shows fallback modal
    Given the browser denies microphone permission
    When I click the microphone button
    Then a modal should appear with German instructions for granting microphone access
    And the modal should contain a "Über Tastatur schreiben" button
    And clicking "Über Tastatur schreiben" should enable text-only mode

  # AC 3: Unsupported browser hides mic button
  Scenario: Unsupported browser shows text-only mode with banner
    Given the browser does not support SpeechRecognition
    Then the microphone button should not be visible
    And a banner should display "Für Sprachgespräche empfehlen wir Chrome"
    And the text input should be the primary input method

  # AC 4: Listening state shows pulsing indicator and interim transcript
  Scenario: Listening state shows visual feedback and interim transcript
    Given voice is active and state is "listening"
    Then a pulsing green indicator should be visible
    And the indicator should show 👂
    And when interim speech is detected the transcript shows in grey italic text

  # AC 5: Speech finalization triggers processing → thinking → speaking
  Scenario: 3-second pause finalizes speech and triggers AI response with TTS
    Given voice is active and state is "listening"
    And Oma has spoken "Ich erinnere mich an den Sommer 1965"
    When a 3-second pause is detected
    Then the voice state should transition to "processing"
    And then to "thinking" when the message is sent to the API
    And then to "speaking" when the AI response is received
    And the AI response should be read aloud via TTS

  # AC 6: Auto-resume after TTS completes
  Scenario: Voice returns to listening after TTS finishes
    Given voice is active and state is "speaking"
    When TTS playback completes
    Then the voice state should return to "listening"
    And the microphone should resume capturing speech

  # AC 7: Interrupting TTS by tapping mic
  Scenario: Tapping mic during speaking cancels TTS
    Given voice is active and state is "speaking"
    When I tap the microphone button
    Then TTS should be cancelled immediately
    And the voice state should transition to "listening"

  # AC 8: 30-second silence triggers gentle prompt
  Scenario: Extended silence after AI response triggers a prompt
    Given voice is active and state is "listening"
    And the AI has responded and 30 seconds of silence have passed
    Then the system should speak "Ich bin noch da — möchten Sie weiterzählen?" via TTS

  # AC 9: 5-minute silence auto-ends session
  Scenario: Very long silence auto-ends the session
    Given voice is active and state is "listening"
    And 5 minutes of silence have passed
    Then the session should be auto-ended with a farewell message
    And the voice state should return to "idle"

  # AC 10: WebSocket stub endpoint
  Scenario: WebSocket endpoint responds with stub error message
    When a WebSocket connection is made to "/api/voice"
    Then the server should accept the connection
    And respond with type "error" and message "Voice WebSocket is not yet implemented. Please use the REST API with browser speech."

  # AC 11: TTS uses German voice at rate 0.9
  Scenario: TTS uses German voice configuration
    Given voice is active and state is "speaking"
    Then TTS should use a voice with lang starting with "de"
    And TTS rate should be 0.9
    And if no German voice is available the default voice is used with a one-time notice

  # AC 12: ARIA live regions announce voice state changes
  Scenario: Voice state changes are announced via ARIA
    Given voice is active
    When the voice state changes to "listening"
    Then the ARIA live region should announce "Ich höre zu"
    When the voice state changes to "processing"
    Then the ARIA live region should announce "Verarbeite Sprache"
    When the voice state changes to "thinking"
    Then the ARIA live region should announce "Denke nach"
    When the voice state changes to "speaking"
    Then the ARIA live region should announce "Spreche Antwort"

  # AC 13: Keyboard accessibility for mic button
  Scenario: Mic button is keyboard accessible
    Then the microphone button should have a correct aria-label
    And the microphone button should have aria-pressed attribute
    And the microphone button should be activatable with Space or Enter
    And tab order should be Mic → End → Text input

  # AC 14: Long TTS responses are chunked on sentence boundaries
  Scenario: Long AI responses are chunked for TTS
    Given the AI returns a response longer than 500 characters
    When TTS speaks the response
    Then the text should be split into chunks on sentence boundaries
    And each chunk should be spoken sequentially

  # AC 15: 60-minute voice sessions with auto-restart
  Scenario: Voice sessions can last 60 minutes
    Given voice is active and state is "listening"
    When the browser STT engine times out
    Then recognition should auto-restart
    And the conversation should continue without interruption
