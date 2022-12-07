const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const fs = require('fs');
const { phoneNumberFormatter } = require('../helpers/formatter');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const mime = require('mime-types');
const express = require('express');
const { body, validationResult } = require('express-validator');
const socketIO = require('socket.io');
var mongoose = require('mongoose');
var dbUrl = 'mongodb+srv://root:root@cluster0.1vupopn.mongodb.net/Bot_samuel'

mongoose.connect(dbUrl , (err) => { 
  console.log('Banco ON');
})
var Message = mongoose.model('Respostas',{ 
  name : String, 
  message : String,
  resposta : String
})


const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));


app.use(fileUpload({
  debug: false
}));


app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

app.get('/treinamento', (req, res) => {
  res.sendFile('treinamento.html', {
    root: __dirname
  });
});

app.get('/messages', (req, res) => {
  Message.find({},(err, messages)=> {
    res.send(messages);
  })
})




app.post('/messages', async (req, res) => {
  try{
    var message = new Message(req.body);

    var savedMessage = await message.save()
   

    var censored = await Message.findOne({message:'badword'});
      if(censored)
        await Message.remove({_id: censored.id})
      else
        io.emit('message', req.body);
      res.sendStatus(200);
  }
  catch (error){
    res.sendStatus(500);
    return console.log('error',error);
  }
 

})

const client = new Client({
  restartOnAuthFail: true,
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ],
  },
  authStrategy: new LocalAuth()
});

client.on('message', msg => {
    client.sendMessage(msg.from, "Funcionando")
  
});



client.initialize();


io.on('connection', function(socket) {
  socket.emit('message', 'Cliente Conectado');
  

  client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QR Code, por gentileza faça a leitura com seu app do whatsapp.');
    });
  });

  client.on('ready', () => {
    socket.emit('ready', 'Lido com sucesso!');
    socket.emit('message', 'Lido com sucesso!');
  });

  client.on('authenticated', () => {
    socket.emit('authenticated', 'Autenticado!');
    socket.emit('message', 'Autenticado!');
    console.log('AUTHENTICATED');
  });

  client.on('auth_failure', function(session) {
    socket.emit('message', 'Falha na autenticação, vamo reiniciar');
  });

  client.on('disconnected', (reason) => {
    socket.emit('message', 'Whatsapp foi desconectado!');
    client.destroy();
    client.initialize();
  });

});




const checkRegisteredNumber = async function(number) {
  const isRegistered = await client.isRegisteredUser(number);
  return isRegistered;
}

// Send message
app.post('/send-message', [
  body('number').notEmpty(),
  body('message').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req).formatWith(({
    msg
  }) => {
    return msg;
  });

  if (!errors.isEmpty()) {
    return res.status(422).json({
      status: false,
      message: errors.mapped()
    });
  }

  const number = phoneNumberFormatter(req.body.number);
  const message = req.body.message;

  const isRegisteredNumber = await checkRegisteredNumber(number);

  if (!isRegisteredNumber) {
    return res.status(422).json({
      status: false,
      message: 'The number is not registered'
    });
  }

  client.sendMessage(number, message).then(response => {
    res.status(200).json({
      status: true,
      response: response
    });
  }).catch(err => {
    res.status(500).json({
      status: false,
      response: err
    });
  });
});



server.listen(port, function() {
  console.log('App running on *: ' + port);
});
