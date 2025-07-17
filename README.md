# Bidirectional Realtime Translator

This is an interpreter for a patient and provider, using the OpenAI Realtime API to facilitate voice interactions.

The agent will recognize either English or Spanish and translate into the other language, facilitating a bidirectional conversation.

If the agent is instructed to book an appointment or order a lab, it will do so after requesting appropriate information (by calling a webhook).

When clicking on "end conversation", the agent will end the session and provide a summary of the conversation.

## Development Setup

1. Clone the repository:
   ```git clone```

2. Navigate to the project directory:
   ```cd realtime-translation-agent```

3. Install dependencies:
   ```npm install```

4. Copy the environment sample file:
   ```cp .env.sample .env```

5. Set your OpenAI API key in the `.env` file

6. Start the development server:
   ```npm run dev```

7. Open your browser and navigate to `http://localhost:3000`

8. You can now interact with the agent via the web interface.
