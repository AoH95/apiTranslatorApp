// all requires
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const speech = require('@google-cloud/speech');
const { Translate } = require('@google-cloud/translate').v2;
const { googleCredential } = require('./config.json');

// All instances needed
const app = express();
const port = 3000;
const upload = multer({dest:'tmp/uploads/'});
ffmpeg.setFfmpegPath(ffmpegPath);
const clientSpeech = new speech.SpeechClient(googleCredential);
const clientTranslate = new Translate(googleCredential);

// Init app
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Endpoint /
app.get('/', (req, res, next) => {
    res.send('<h2>Welcome to API-Translatov</h2>');
});

app.post('/', upload.single('audio'), async (req, res) => {
   // Get URI Audi |  From & To Languages
  const { path: uri } = req.file;
  const languages = req.body;

  ffmpeg()
    .input(uri)
    .outputOptions([
        '-f s16le',
        '-acodec pcm_s16le',
        '-vn',
        '-ac 1',
        '-ar 41k',
        '-map_metadata -1'
    ])
    .save(`${uri}_encoded`)
    .on('end', async () => {
      const config = {
        encoding: 'LINEAR16',
        sampleRateHertz: 41000,
        languageCode: languages.from,
      };

      // Get Buffer from audio file
      const savedFile = fs.readFileSync(`${uri}_encoded`)
      if (!savedFile) {
        reject('file can not be read')
      }

      const audioBytes = savedFile.toString('base64');
      const audio = {
        content: audioBytes,
      };

      const transcription = await _speechToText({ audio, config });
      console.log('transcription', transcription);
      const translation = await _translate(transcription, languages.to);
      console.log('translation', translation);

      res.json({
        from: {
          lang: languages.from,
          text: transcription
        },
        to: {
          lang: languages.to,
          text: translation
        },
      });
    });
});

const _speechToText = async option => {
  try {
    const [response] = await clientSpeech.recognize(option);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');
    return transcription;
  } catch (error) {
    console.log(error);
  }
};

const _translate = async (text, target) => {
  let [translations] = await clientTranslate.translate(text, target);
  translations = Array.isArray(translations) ? translations : [translations];
  return translations[0];
};

app.listen(port, () => console.log(`Hello world app listening on port ${port}!`))