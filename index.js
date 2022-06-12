import prism from "prism-media";

import {
  Client,
  Intents,
  MessageEmbed,
  MessageActionRow,
  MessageButton,
} from "discord.js";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";
import fs from "fs";
import ytdl from "ytdl-core";
import yts from "yt-search";
import {
  entersState,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { createWriteStream } from "fs";
import { pipeline } from "node:stream";
import { DiscordTogether } from "discord-together";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { createPlaylist, getPlaylists } from "./Operations.js";



const client = new Client({
  presence: {
    status: "dnd",
  },
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_VOICE_STATES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  ],
});
client.discordTogether = new DiscordTogether(client);

const VERSION = "0.0.3";

const queue = {};
const ai = {};

client.once("ready", (client) => {
  console.log("Online... (" + client.readyTimestamp + ")");
});
client.on("guildCreate", async (guild) => {
  console.log("New Guild...");

  const restClient = new REST({ version: "9" }).setToken(
    "OTYzMzg5NTA2NzMwNDgzNzEy.YlVYZQ.YWXoGkCMxPDuJVXZim9DFwQMh9k"
  );

  restClient
    .put(
      Routes.applicationGuildCommands(
        "963389506730483712",
        guild.id.toString()
      ),
      {
        body: [
          {
            name: "play",
            type: 1,
            description:
              "Höre dir einen Song von Youtube in einem Sprachkanal an.",
            options: [
              {
                name: "name",
                description: "Name des Songs",
                type: 3,
                required: true,
              },
            ],
          },
          {
            name: "playlist",
            type: 1,
            description:
              "Speichere deine Lieblingslieder in einer Playlist.",
            options: [
              {
                name: "operation",
                description: "Was soll mit deiner Playlist passieren?",
                type: 3,
                required: true,
                choices: [
                  {
                    name: "Playlist erstellen",
                    value: "createPlaylist",
                  },
                  {
                    name: "Meine Playlists",
                    value: "myPlaylists",
                  },
                  {
                    name: "Synchronisieren",
                    value: "syncPlaylist",
                  },
                ]
              }
            ],
          },
        ],
      }
    )
    .then(() => console.log("Successfully created commands in guild"))
    .catch((e) => console.error(e));
});
client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand()) {
    if (interaction.commandName === "play") {
      let name = interaction.options.getString("name");
      let video = await getVideo(name);
      let voicechannel = interaction.member.voice.channel;
      if (!voicechannel) {
        await interaction.reply({
          embeds: [
            {
              title: "Hey!",
              description:
                "Du musst in einem Sprachkanal sein um den Command nutzen zu können.",
              color: 16713022,
            },
          ],
        });
      } else {
        let permissions = voicechannel.permissionsFor(client.user);
        if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
          await interaction.reply({
            embeds: [
              {
                title: "Hey!",
                description:
                  "Ich brauche Sprech- und Beitrittspermissions für diesen Kanal.",
                color: 16713022,
              },
            ],
          });
        } else {
          if (queue[voicechannel.id] === undefined) {
            queue[voicechannel.id] = {};
            queue[voicechannel.id].guild = interaction.guild;
            var connection = await joinVoiceChannel({
              channelId: voicechannel.id,
              guildId: queue[voicechannel.id].guild.id,
              adapterCreator: queue[voicechannel.id].guild.voiceAdapterCreator,
            });
            const audioPlayer = await createAudioPlayer();
            queue[voicechannel.id].audioPlayer = audioPlayer;
            queue[voicechannel.id].member = interaction.member;
            queue[voicechannel.id].connection = connection;
            queue[voicechannel.id].interaction = interaction;
            queue[voicechannel.id].songs = [];
            queue[voicechannel.id].songs.push(video.url);
            queue[voicechannel.id].course = [];

            console.log(video.image);
            let embed = new MessageEmbed()
              .setTitle(video.title)
              .setURL(video.url)
              .setImage(video.thumbnail)
              .setDescription(video.author.name)
              .setFooter(voicechannel.name);
            let controls = new MessageActionRow().addComponents(
              new MessageButton()
                .setCustomId("back")
                .setLabel("⏮")
                .setStyle("PRIMARY")
                .setDisabled(true),
              new MessageButton()
                .setCustomId("pause")
                .setLabel("⏸")
                .setStyle("SUCCESS"),
              new MessageButton()
                .setCustomId("forward")
                .setLabel("⏭")
                .setStyle("PRIMARY")
                .setDisabled(true)
            );
            let info = await interaction.reply({
              embeds: [embed],
              components: [controls],
            });
            queue[voicechannel.id].message = info;
            await play(voicechannel.id);
          } else {
            queue[voicechannel.id].songs.push(video.url);

            await interaction.reply({
              embeds: [
                {
                  title: video.title,
                  description:
                    "Added to Queue! Currently " +
                    queue[voicechannel.id].songs.length +
                    " songs in Queue",
                  thumbnail: video.image,
                  footer: {
                    text: voicechannel.name,
                  },
                },
              ],
              ephemeral: true,
            });
            let navigation = new MessageActionRow().addComponents(
              new MessageButton()
                .setCustomId("back")
                .setLabel("⏮")
                .setStyle("PRIMARY")
                .setDisabled(
                  queue[voicechannel.id].course.length === 0 ? true : false
                ),
              new MessageButton()
                .setCustomId("pause")
                .setLabel("⏸")
                .setStyle("SUCCESS"),
              new MessageButton()
                .setCustomId("forward")
                .setLabel("⏭")
                .setStyle("PRIMARY")
                .setDisabled(
                  queue[voicechannel.id].songs.length > 1 ? false : true
                )
            );

            let msg = await queue[voicechannel.id].interaction.fetchReply();

            await msg.edit({
              embeds: [msg.embeds[0]],
              components: [navigation],
            });
          }
        }
      }
    }
    if (interaction.commandName === "playlist") {
      let operation = interaction.options.getString("operation");
      await interaction.reply({
        embeds: [{
          title: "Ladevorgang...",
          description: "```Verbindung zum Server wird hergestellt...```",
        }]
      })

      //OPERATIONS
      if(operation === "myPlaylists"){
        try {
          await getPlaylists(client, interaction);
        } catch (e) {
          console.log(e);
          let controls = new MessageActionRow().addComponents(
            new MessageButton()
              .setCustomId("reportErrorCreatePlaylist")
              .setLabel("Fehler melden")
              .setStyle("DANGER")
              .setDisabled(false),
          );
          interaction.editReply({
            embeds: [{
              title: "Error",
              description: "```Beim Abrufen deiner Playlists ist ein Fehler aufgetreten```",
            }]
          })
        }
      }
      if(operation === "createPlaylist"){

      }
      if(operation === "syncPlaylist"){

      }
    }
  }

  if (interaction.isButton()) {
    if (interaction.customId === "back") {
      let voiceChannelId = interaction.member.voice.channelId;
      if (voiceChannelId !== undefined || voiceChannelId !== null) {
        let name = interaction.message.embeds[0].footer.text.toString();
        if (name !== interaction.member.voice.channel.name) {
          await interaction.reply({
            embeds: [
              {
                title: "Hey!",
                description:
                  "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
                color: 16713022,
              },
            ],
            ephemeral: true,
          });
          return;
        }
      } else {
        await interaction.reply({
          embeds: [
            {
              title: "Hey!",
              description:
                "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
              color: 16713022,
            },
          ],
          ephemeral: true,
        });
        return;
      }

      if (queue[voiceChannelId].connection === undefined) return;
      let audioPlayer = queue[voiceChannelId].audioPlayer;
      let connection = queue[voiceChannelId].connection;
      let interaction2 = queue[voiceChannelId].interaction;

      if (queue[voiceChannelId].course !== undefined) {
        await audioPlayer.pause();
        let tempsong = queue[voiceChannelId].course.pop();
        let temp = queue[voiceChannelId].songs;
        let newarray = [tempsong].concat(temp);
        queue[voiceChannelId].songs = newarray;
        await play(voiceChannelId);

        let controls = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId("back")
            .setLabel("⏮")
            .setStyle("PRIMARY")
            .setDisabled(
              queue[voiceChannelId].course.length < 1 ? true : false
            ),
          new MessageButton()
            .setCustomId("pause")
            .setLabel("⏸")
            .setStyle("SUCCESS"),
          new MessageButton()
            .setCustomId("forward")
            .setLabel("⏭")
            .setStyle("PRIMARY")
            .setDisabled(false)
        );
        let video = await getVideo(queue[voiceChannelId].songs[0]);
        let embed = new MessageEmbed()
          .setTitle(video.title)
          .setURL(video.url)
          .setImage(video.thumbnail)
          .setDescription(video.author.name)
          .setFooter(interaction.member.voice.channel.name);
        await interaction.update({
          embeds: [embed],
          components: [controls],
        });
      }
    }
    if (interaction.customId === "pause") {
      let voiceChannelId = interaction.member.voice.channelId;
      if (voiceChannelId === undefined || voiceChannelId === null) {
        let name = interaction.message.embeds[0].footer.text.toString();
        if (name !== interaction.member.voice.channel.name) {
          await interaction.reply({
            embeds: [
              {
                title: "Hey!",
                description:
                  "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
                color: 16713022,
              },
            ],
            ephemeral: true,
          });
          return;
        }
      }
      if (queue[voiceChannelId].connection === undefined) return;
      let audioPlayer = queue[voiceChannelId].audioPlayer;
      await audioPlayer.pause();
      let controls = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("back")
          .setLabel("⏮")
          .setStyle("PRIMARY")
          .setDisabled(queue[voiceChannelId].course.length < 1 ? true : false),
        new MessageButton()
          .setCustomId("unpause")
          .setLabel("▶")
          .setStyle("SUCCESS"),
        new MessageButton()
          .setCustomId("forward")
          .setLabel("⏭")
          .setStyle("PRIMARY")
          .setDisabled(queue[voiceChannelId].songs.length === 1 ? true : false)
      );
      await interaction.update({
        embeds: interaction.message.embeds,
        components: [controls],
      });
    }
    if (interaction.customId === "forward") {
      let voiceChannelId = interaction.member.voice.channelId;
      if (voiceChannelId !== undefined || voiceChannelId !== null) {
        let name = interaction.message.embeds[0].footer.text.toString();
        if (name !== interaction.member.voice.channel.name) {
          await interaction.reply({
            embeds: [
              {
                title: "Hey!",
                description:
                  "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
                color: 16713022,
              },
            ],
            ephemeral: true,
          });
          return;
        }
      } else {
        await interaction.reply({
          embeds: [
            {
              title: "Hey!",
              description:
                "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
              color: 16713022,
            },
          ],
          ephemeral: true,
        });
        return;
      }

      if (queue[voiceChannelId].connection === undefined) return;
      let audioPlayer = queue[voiceChannelId].audioPlayer;
      let connection = queue[voiceChannelId].connection;
      let interaction2 = queue[voiceChannelId].interaction;
      if (queue[voiceChannelId].songs.length > 1) {
        await audioPlayer.pause();
        queue[voiceChannelId].course.push(queue[voiceChannelId].songs[0]);
        queue[voiceChannelId].songs.shift();

        await play(voiceChannelId);

        let controls = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId("back")
            .setLabel("⏮")
            .setStyle("PRIMARY")
            .setDisabled(false),
          new MessageButton()
            .setCustomId("pause")
            .setLabel("⏸")
            .setStyle("SUCCESS"),
          new MessageButton()
            .setCustomId("forward")
            .setLabel("⏭")
            .setStyle("PRIMARY")
            .setDisabled(queue[voiceChannelId].songs.length <= 1 ? true : false)
        );
        let video = await getVideo(queue[voiceChannelId].songs[0]);
        let embed = new MessageEmbed()
          .setTitle(video.title)
          .setURL(video.url)
          .setImage(video.thumbnail)
          .setDescription(video.author.name)
          .setFooter(interaction.member.voice.channel.name);
        await interaction.update({
          embeds: [embed],
          components: [controls],
        });
      } else {
        await interaction.reply({
          content: "Es ist wohl ein Fehler aufgetreten",
          ephemeral: true,
        });
      }
    }
    if (interaction.customId === "unpause") {
      let voiceChannelId = interaction.member.voice.channelId;
      if (voiceChannelId !== undefined && voiceChannelId !== null) {
        let name = interaction.message.embeds[0].footer.text.toString();
        if (name !== interaction.member.voice.channel.name) {
          await interaction.reply({
            embeds: [
              {
                title: "Hey!",
                description:
                  "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
                color: 16713022,
              },
            ],
            ephemeral: true,
          });
          return;
        }
      } else {
        await interaction.reply({
          embeds: [
            {
              title: "Hey!",
              description:
                "Du musst im entsprechenden Sprachkanal sein, um dessen Musik zu steuern!",
              color: 16713022,
            },
          ],
          ephemeral: true,
        });
        return;
      }
      if (queue[voiceChannelId].connection === undefined) {
        return;
      }
      let audioPlayer = queue[voiceChannelId].audioPlayer;
      await audioPlayer.unpause();
      let controls = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("back")
          .setLabel("⏮")
          .setStyle("PRIMARY")
          .setDisabled(queue[voiceChannelId].course.length >= 1 ? false : true),
        new MessageButton()
          .setCustomId("pause")
          .setLabel("⏸")
          .setStyle("SUCCESS"),
        new MessageButton()
          .setCustomId("forward")
          .setLabel("⏭")
          .setStyle("PRIMARY")
          .setDisabled(queue[voiceChannelId].songs.length >= 1 ? true : false)
      );
      await interaction.update({
        embeds: interaction.message.embeds,
        components: [controls],
      });
    }
    if (interaction.customId === "createPlaylist") {
      await interaction.update({
        embeds: [
          {
            title: "Ladevorgang",
            description: "```Playlist wird erstellt (0%)```",
          }
        ],
        components: []
      })

      await createPlaylist(client, interaction);

    }
  }
});

client.on("voiceStateUpdate", async (olds, news) => {
  if (olds.member.user.bot) return;
  if (
    olds.channelId !== null &&
    olds.channelId !== undefined &&
    (news.channel === null || news.channel === undefined)
  ) {
    if (queue[olds.channelId] !== undefined) {
      if (olds.channel.members.length > 1) {
        return;
      } else {
        await queue[olds.channelId].connection.destroy();

        try {
          let msg = await queue[olds.channelId].interaction.fetchReply();
          await msg.delete();
        } catch (e) { }

        queue[olds.channelId] = undefined;
      }
    }
  }
});

const play = async (channelId) => {
  let connection = queue[channelId].connection;
  let audioPlayer = queue[channelId].audioPlayer;
  let subscription = await connection.subscribe(audioPlayer);
  queue[channelId].subscription = subscription;
  try {
    const internalReadable = await ytdl(queue[channelId].songs[0], {
      lang: "de",
      filter: "audioonly",
      format: "audioonly",
      quality: "highestaudio",
    });
    const audioResource = await createAudioResource(internalReadable);
    await audioPlayer.play(audioResource);
  } catch (e) {
    let msg = await queue[olds.channelId].interaction.fetchReply();
    let controls = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("error_help")
        .setStyle("DANGER")
        .setLabel("Melden")
    );
    await msg.edit({
      embeds: [
        {
          title: "Fehler",
          description:
            "Drücke 'Melden', um den Fehler an das Entwicklerteam zu senden.",
        },
      ],
      components: [controls],
    });
  }

  audioPlayer.on(AudioPlayerStatus.Idle, async () => {
    if (queue[channelId].course === undefined) queue[channelId].course = [];
    queue[channelId].course.push(queue[channelId].songs[0]);
    let temp = queue[channelId].songs[0];
    queue[channelId].songs.shift();

    if (queue[channelId].songs.length <= 0) {
      //surround with try catch

      try {
        await connection.destroy();
        let msg = await queue[channelId].interaction.fetchReply();
        await msg.delete();
        queue[channelId] = undefined;
      } catch (e) { }
      return;
    } else {
      let video = await getVideo(queue[channelId].songs[0]);
      let controls = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId("back")
          .setLabel("⏮")
          .setStyle("PRIMARY")
          .setDisabled(false),
        new MessageButton()
          .setCustomId("pause")
          .setLabel("⏸")
          .setStyle("SUCCESS"),
        new MessageButton()
          .setCustomId("forward")
          .setLabel("⏭")
          .setStyle("PRIMARY")
          .setDisabled(queue[channelId].songs.length <= 1 ? true : false)
      );
      let embed = new MessageEmbed()
        .setTitle(video.title)
        .setURL(video.url)
        .setImage(video.thumbnail)
        .setDescription(video.author.name)
        .setFooter(queue[channelId].interaction.member.voice.channel.name)
        .setAuthor({
          name: "🔊 Hi-Res",
        });

      let msg = await queue[channelId].interaction.fetchReply();
      msg.edit({
        embeds: [embed],
        components: [controls],
      })
      await subscription.unsubscribe();
      await play(channelId);
    }
  });
};
async function getVideo(name) {
  let r = await yts(name.toString());
  let video = r.videos[0];

  return video;
}

client.login("OTYzMzg5NTA2NzMwNDgzNzEy.YlVYZQ.YWXoGkCMxPDuJVXZim9DFwQMh9k");