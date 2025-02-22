# Discord Meeting Bot

This project is a Discord bot designed to record, transcribe, and summarize meetings held in voice channels. The bot uses the OpenAI API for transcription and summarization.

## Features

- Record audio from voice channels
- Transcribe recorded audio
- Summarize transcriptions
- Send transcriptions, and summaries
- Delete recordings or whole meetings

## Setup

### Prerequisites

- Python 3.9+
- Discord bot token
- OpenAI API key

### Installation

1. Clone the repository:

    ```sh
    git clone <repository-url>
    cd <repository-directory>
    ```

2. Create a virtual environment and activate it:

    ```sh
    python -m venv venv
    source venv/bin/activate  # On Windows use `venv\Scripts\activate`
    ```

3. Install the required packages:

    ```sh
    pip install -r requirements.txt
    ```

4. Create a [.env](http://_vscodecontentref_/1) file in the root directory and add your credentials:

    ```env
    DISCORD_APP_TOKEN=<your-discord-bot-token>
    GUILD_ID=<your-guild-id>
    OPENAI_API_KEY=<your-openai-api-key>
    ```

## Usage

Run the bot:

```sh
python src/bot.py
```

## Docker Deployment

To deploy the bot using Docker, you can use the provided `Dockerfile`.

1. Build the Docker image:

    ```sh
    docker build -t discord-meeting-bot .
    ```

2. Run the Docker container:

    ```sh
    docker run -d --name discord-meeting-bot-container discord-meeting-bot
    ```

## Commands

> **Allowed roles**: Admin, Przewodniczący sekcji, Weekly Transcription Bot Operator

> **Sufficient permissions integer**: 7374848

### `/start_meeting`

Starts recording audio from the voice channel.

- **meeting_name**: The name of the meeting (required)

### `/stop_meeting`

Stops recording audio from the voice channel, transcribes, and summarizes the meeting.

### `/saved_meetings`

Displays saved meetings data.

### `/send_transcription`

Sends the saved transcription.

- **meeting_name**: The name of the meeting (required)

### `/send_summary`

Sends the saved summary.

- **meeting_name**: The name of the meeting (required)
- **output_type**: The type of output (message or text) (required)

### `/delete_recording`

Deletes the saved recording.

- **meeting_name**: The name of the meeting (required)

### `/delete_meeting`

Deletes the saved meeting.

- **meeting_name**: The name of the meeting (required)

---

###### Generated by GitHub Copilot because I'm too lazy to write this
