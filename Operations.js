import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
    Client,
    Intents,
    MessageEmbed,
    MessageActionRow,
    MessageButton,
} from "discord.js";

const Canvas = require('@napi-rs/canvas');


export async function createPlaylist(client,interaction) {
    let app = await initializeApp({
        apiKey: "AIzaSyA-J1qhZ3dg_t86dOIAQT2ckCENRo3ey2s",
        authDomain: "jonasl.firebaseapp.com",
        projectId: "jonasl",
        storageBucket: "jonasl.appspot.com",
        messagingSenderId: "547350605261",
        appId: "1:547350605261:web:6ddccc17261b9530aca884",
        measurementId: "G-FBXRTYLTZD"
      })
      let db = await getFirestore(app);
      let auth = await getAuth(app);

      try {
        signInWithEmailAndPassword(auth, "mail@jonaslang.eu", "discord123").then((userCredentials) => {
            var userId = interaction.user.id;
            let docRef = doc(db, "discord", userId);
            let docSnap = getDoc(docRef);

            interaction.editReply({
              embeds: [
                {
                  title: "Ladevorgang",
                  description: "```Playlist wird erstellt (40%)```",
                }
              ],
              components: []
            });

            setDoc(doc(db, "discord", userId), {
              username: interaction.user.username,
              userId: userId,
              playlists: [
                {
                  name: "Playlist von "+interaction.user.username,
                  description: "",
                  ownerId: userId,
                  createdAt: new Date().toISOString(),
                  songs: []
                }
              ]
            })

            interaction.editReply({
              embeds: [
                {
                  title: "Ladevorgang",
                  description: "```Playlist wird erstellt (90%)```",
                }
              ],
              components: []
            });

            interaction.editReply({
              embeds: [
                {
                  title: "Deine Playlist wurde erstellt",
                  description: "Playlist von "+interaction.user.username+" (0 Songs)",
                  fields: [
                    {
                      name: "Wie füge ich Songs zu meiner Playlist hinzu?"
                    }
                  ]
                }
              ],
              components: []
            });






        })
        








    } catch (e){
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
            description: "```Bei der Erstellung der Playlist ist ein Fehler aufgetreten```",
          }]
        })
    }
      
}


export async function getPlaylists(client,interaction) {
  let app = await initializeApp({
    apiKey: "AIzaSyA-J1qhZ3dg_t86dOIAQT2ckCENRo3ey2s",
    authDomain: "jonasl.firebaseapp.com",
    projectId: "jonasl",
    storageBucket: "jonasl.appspot.com",
    messagingSenderId: "547350605261",
    appId: "1:547350605261:web:6ddccc17261b9530aca884",
    measurementId: "G-FBXRTYLTZD"
  })
  let db = await getFirestore(app);
  let auth = await getAuth(app);

  signInWithEmailAndPassword(auth, "mail@jonaslang.eu", "discord123").then(async (userCredentials) => {
      var userId = interaction.user.id;
      let docRef = doc(db, "discord", userId);

      interaction.editReply({
        embeds: [
          {
            title: "Ladevorgang",
            description: "```Playlists werden geladen```",
          }
        ],
        components: []
      })

      let docSnap = await getDoc(docRef);
      if(docSnap.exists() && docSnap.data !== undefined){
        let data = docSnap.data()
        console.log(data);

        interaction.editReply({
          embeds: [
            {
              title: "Beta Feature",
              description: "Dieses Feature ist aktuell den Entwicklern vorbehalten."
            }
          ]
        })

      } else {
        let controls = new MessageActionRow().addComponents(
          new MessageButton()
            .setCustomId("createPlaylist")
            .setLabel("Playlist erstellen")
            .setStyle("SUCCESS")
            .setDisabled(false),
        );
        interaction.editReply({
          embeds: [{
            title: "Keine Playlists gefunden",
            description: "Es wurden keine Playlists gefunden, die mit ihrem Konto verknüpft sind. Wollen sie eine neue erstellen?"
          }],
          components: [controls]
        })
      }



    }).catch(e => {
    console.log(e);
    let controls = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId("reportErrorGetPlaylists")
        .setLabel("Fehler melden")
        .setStyle("DANGER")
        .setDisabled(false),
    );
    interaction.editReply({
      embeds: [{
        title: "Error",
        description: "```Beim Abrufen deiner Playlists ist ein Fehler aufgetreten```",
      }],
      components: [controls]
    })
  })
}