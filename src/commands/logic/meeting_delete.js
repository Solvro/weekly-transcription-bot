const fs = require('fs');
const path = require('path');
const { MessageFlags } = require('discord.js');
const state = require('../../utils/state');
const embeds = require('../../utils/embeds');
const config = require('config');

module.exports = {
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const choices = state.meetings.map((meeting) => meeting.name);
    const filtered = choices
      .filter((choice) => choice.toLowerCase().startsWith(focusedValue))
      .slice(0, 25);

    await interaction.respond(
      filtered.map((choice) => ({ name: choice, value: choice }))
    );
  },

  async execute(interaction) {
    const memberRoles = interaction.member.roles.cache.map((role) => role.name);
    const hasPermission = memberRoles.some((role) =>
      config.get('allowed_roles').includes(role)
    );

    if(!hasPermission)
      return await interaction.reply({
        embeds: [embeds.noPermissionEmbed],
        flags: MessageFlags.Ephemeral,
      });

    await interaction.deferReply();

    const meetingName = interaction.options.getString('name');
    const what = interaction.options.getString('what');
    const MEETINGS_DIR = path.join(__dirname, '../../../meetings/');
    const meetingPath = path.join(MEETINGS_DIR, meetingName);

    if(!fs.existsSync(meetingPath))
      return await interaction.editReply({
        embeds: [embeds.meetingDoesNotExistEmbed],
        flags: MessageFlags.Ephemeral,
      });

    if(what === 'recording') {
      const files = fs.readdirSync(meetingPath);
      const audioFiles = files.filter(
        (file) => file.endsWith('.ogg') || file.endsWith('.mp3')
      );

      if(audioFiles.length === 0)
        return await interaction.editReply({
          embeds: [embeds.noRecordingsExistEmbed],
          flags: MessageFlags.Ephemeral,
        });

      audioFiles.forEach((file) => fs.unlinkSync(path.join(meetingPath, file)));

      const meeting = state.meetings.find(
        (meeting) => meeting.name === meetingName
      );
      if(meeting) meeting.recorded = false;

      await interaction.editReply({ embeds: [embeds.fileDeletedEmbed] });
    } else {
      fs.rmSync(meetingPath, { recursive: true, force: true });
      state.meetings = state.meetings.filter(
        (meeting) => meeting.name !== meetingName
      );
      await interaction.editReply({ embeds: [embeds.meetingDeletedEmbed] });
    }
  },
};
