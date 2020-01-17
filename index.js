// all requires
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const { Translate } = require('@google-cloud/translate').v2;
const { googleCredential } = require('./config.json');
// All instances needed
const app = express();
const port = 3000;
const upload = multer();
const clientSpeech = new speech.SpeechClient(googleCredential);
const clientTranslate = new Translate(googleCredential);

// Init app
app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Endpoint /
app.post('/', upload.single('audio'), async (req, res) => {
  // Get From & To Languages
  const languages = req.body;

  // Config for Speech-to-text Api
  const config = {
    encoding: 'LINEAR16',
    sampleRateHertz: 41000,
    languageCode: languages.from,
  };

  // Get Buffer from audio file
  const audioBytes = req.file.buffer.toString('base64');
  const audio = {
    content: audioBytes,
  };

  const transcription = await _speechToText({ audio, config });
  const translation = await _translate(transcription, languages.to);
  
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