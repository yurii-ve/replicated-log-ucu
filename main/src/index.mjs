import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

const PORT = process.env.PORT ?? 8080;
const app = express();

app.use(bodyParser.json());
app.use(morgan('dev'));

const messages = new Map();

const secondaryHosts = process.env.SECONDARY_HOSTS?.split(' ') ?? [];

let messagesCount = 0;

app.post('/message', async (req, res) => {
  const w = req.body.w ?? 1; // write concern parameter

  if (w <= 0) {
    res
      .status(400)
      .send({ error: 'Write concern parameter w must be larger than 0' });
  }

  const newMessageId = messagesCount++;
  messages.set(newMessageId, null);

  function replicateMessageToSecondary(host, message) {
    const url = `${host}/message`;
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify(message);

    return fetch(url, { method: 'POST', headers, body });
  }

  function saveMessageAndResponse() {
    messages.set(newMessageId, req.body.message);
    res.status(200).send('OK');
  }

  let replicationResponseCount = 0;
  const requiredSecondaryAcksAmount = w - 1;

  for (const secondaryHost of secondaryHosts) {
    const messageObject = { id: newMessageId, message: req.body.message };
    replicateMessageToSecondary(secondaryHost, messageObject).then(() => {
      replicationResponseCount++;
      if (
        replicationResponseCount === requiredSecondaryAcksAmount ||
        replicationResponseCount === secondaryHost.length
      ) {
        saveMessageAndResponse();
      }
    });
  }

  if (requiredSecondaryAcksAmount === 0 || secondaryHosts.length === 0) {
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

app.listen(PORT, () => {
  console.log(`MAIN is listening on port ${PORT}`);
});
