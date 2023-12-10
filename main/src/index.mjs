import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import { SecondariesService } from './secondaries-service.mjs';

const PORT = process.env.PORT ?? 3000;
const app = express();

app.use(bodyParser.json());
app.use(morgan('dev'));

const messages = new Map();

const secondariesService = new SecondariesService();
secondariesService.init();

secondariesService.subscribeToStatusChange((id, info) => {
  if (info.newStatus === 'Healthy') {
    for (const [messageId, message] of messages.entries()) {
      secondariesService.replicateToInstance(id, { id: messageId, message });
    }
  }
});

let messagesCount = 0;

app.post('/message', async (req, res) => {
  const writeConcern = req.body.w ?? 1; // write concern parameter

  if (writeConcern <= 0) {
    res.status(400).send({ error: 'Invalid write concern' });
  }

  const newMessageId = messagesCount++;
  messages.set(newMessageId, null);

  let responded = false;
  function saveMessageAndResponse() {
    messages.set(newMessageId, req.body.message);
    res.status(200).send('OK');
    responded = true;
  }

  let replicationResponseCount = 0;
  const requiredSecondaryAcksAmount = writeConcern - 1;

  const messageObject = { id: newMessageId, message: req.body.message };
  secondariesService.replicateToAllInstances(messageObject, () => {
    replicationResponseCount++;
    if (responded) {
      return;
    }

    if (
      replicationResponseCount === requiredSecondaryAcksAmount ||
      replicationResponseCount === secondariesService.getAllInstances().length
    ) {
      saveMessageAndResponse();
    }
  });

  if (
    requiredSecondaryAcksAmount === 0 ||
    secondariesService.getAllInstances().length === 0
  ) {
    saveMessageAndResponse();
  }
});

app.get('/messages', (_, res) => {
  const sortedKeys = [...messages.keys()].sort((a, b) => a - b);
  const savedMessages = sortedKeys
    .map((key) => messages.get(key))
    .filter((msg) => msg !== null);

  res.status(200).send({ messages: savedMessages });
});

app.get('/health', (_, res) => {
  const status = secondariesService.getStatus();
  res.send(status);
});

app.listen(PORT, () => {
  console.log(`MAIN is listening on port ${PORT}`);
});
