const {
  joinVoiceChannel,
  EndBehaviorType,
  VoiceConnectionStatus,
} = require('@discordjs/voice');
const fs = require('fs');
const path = require('path');
const prism = require('prism-media');
const { spawn } = require('child_process');
const ffmpeg = require('ffmpeg-static');
const { PassThrough } = require('stream');
const { Mixer, Input } = require('audio-mixer');
const state = require('../../utils/state.js');
const config = require('../../../config.json');
const AsyncLock = require('async-lock');
const { waitForDrain } = require('../../utils/utils.js');

const {
  recordingStartedEmbed,
  recordingAlreadyStartedEmbed,
  noPermissionEmbed,
  meetingAlreadyExistsEmbed,
  noVoiceChannelEmbed,
  errorWhileRecordingEmbed,
} = require('../../utils/embeds.js');

const stateLock = new AsyncLock();

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const memberRoles = interaction.member.roles.cache.map((role) => role.name);
    const hasPermission = memberRoles.some((role) =>
      config.allowed_roles.includes(role)
    );

    if(!hasPermission)
      return await interaction.editReply({
        embeds: [noPermissionEmbed],
        ephemeral: true,
      });

    await stateLock.acquire('recording', async () => {
      if(state.currentMeeting)
        return await interaction.editReply({
          embeds: [recordingAlreadyStartedEmbed],
          ephemeral: true,
        });

      const meetingName = interaction.options.getString('name');

      if(state.meetings.map((m) => m.name).includes(meetingName))
        return await interaction.editReply({
          embeds: [meetingAlreadyExistsEmbed],
          ephemeral: true,
        });

      const voiceChannel = interaction.member.voice.channel;
      if(!voiceChannel)
        return await interaction.editReply({
          embeds: [noVoiceChannelEmbed],
          ephemeral: true,
        });

      try {
        state.connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: interaction.guild.id,
          adapterCreator: interaction.guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: true,
        });

        if(!state.connection) {
          return await interaction.editReply({
            embeds: [errorWhileRecordingEmbed],
          });
        }

        state.currentMeeting = meetingName;
        await interaction.editReply({ embeds: [recordingStartedEmbed] });

        const MEETINGS_DIR = path.join(__dirname, '../../../meetings/');
        const meetingFolder = path.join(MEETINGS_DIR, state.currentMeeting);

        if(!fs.existsSync(meetingFolder))
          fs.mkdirSync(meetingFolder, { recursive: true });

        const mp3Path = path.join(meetingFolder, `${state.currentMeeting}.mp3`);

        state.audioMixer = new Mixer({
          channels: 1,
          bitDepth: 16,
          sampleRate: 48000,
          clearInterval: 20,
        });

        state.recordingProcess = spawn(ffmpeg, [
          '-f',
          's16le',
          '-ar',
          '48000',
          '-ac',
          '1',
          '-i',
          'pipe:0',
          '-af',
          'loudnorm',
          '-codec:a',
          'libmp3lame',
          '-q:a',
          '2',
          '-y',
          mp3Path,
        ]);

        state.cleanupRecording = async () => {
          if(state.audioMixer) {
            state.audioMixer.destroy();
            await waitForDrain(state.audioMixer);
          }

          if(state.recordingProcess) {
            state.recordingProcess.stdin.end();
            await new Promise((resolve) =>
              state.recordingProcess.once('close', resolve)
            );
          }

          for(const [, streamInfo] of userStreams) {
            streamInfo.audioStream.destroy();
            streamInfo.pcmStream.destroy();
            streamInfo.opusDecoder.destroy();
            state.audioMixer.removeInput(streamInfo.mixerInput);
          }

          userStreams.clear();
        };

        state.recordingProcess.on('error', (err) => {
          console.error('Recording process error: ', err);
          interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
          state.connection.destroy();
          state.connection = null;
        });

        state.recordingProcess.on('close', async (code) => {
          state.finishedRecordingCode = code;
          if(!fs.existsSync(mp3Path)) {
            console.error('MP3 file does not exist');
            fs.rmdirSync(meetingFolder, { recursive: true });
            await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
          } else {
            console.log('Recording saved successfully');
          }
        });

        state.audioMixer.pipe(state.recordingProcess.stdin);

        const receiver = state.connection.receiver;
        const userStreams = new Map();

        receiver.speaking.on('start', (userId) => {
          if(userStreams.has(userId)) return;

          const opusDecoder = new prism.opus.Decoder({
            rate: 48000,
            channels: 1,
          });

          const pcmStream = new PassThrough();

          const audioStream = receiver.subscribe(userId, {
            end: {
              behaviour: EndBehaviorType.AfterSilence,
              duration: 200,
            },
          });

          audioStream.pipe(opusDecoder).pipe(pcmStream);

          const mixerInput = new Input({
            channels: 1,
            bitDepth: 16,
            sampleRate: 48000,
            volume: 3.0,
          });

          pcmStream.pipe(mixerInput);
          state.audioMixer.addInput(mixerInput);

          userStreams.set(userId, {
            audioStream,
            opusDecoder,
            pcmStream,
            mixerInput,
          });
        });

        receiver.speaking.on('end', (userId) => {
          const streamInfo = userStreams.get(userId);
          if(streamInfo) {
            streamInfo.audioStream.destroy();
            streamInfo.opusDecoder.destroy();
            streamInfo.pcmStream.destroy();
            state.audioMixer.removeInput(streamInfo.mixerInput);
            userStreams.delete(userId);
          }
        });

        state.connection.on('stateChange', (oldState, newState) => {
          if(newState.status === VoiceConnectionStatus.Disconnected) {
            console.error('Unexpected disconnection!');
            state.cleanupRecording();
            state.connection.destroy();
            state.connection = null;
          }
        });
      } catch(error) {
        console.error('Meeting start error:', error);
        if(state.connection) {
          state.connection.destroy();
          state.connection = null;
        }

        await interaction.editReply({ embeds: [errorWhileRecordingEmbed] });
      }
    });
  },
};
