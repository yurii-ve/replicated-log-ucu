import express from 'express';
import bodyParser from 'body-parser';
import * as uuid from 'uuid';
import morgan from 'morgan';

const PORT = process.env.PORT ?? 8080;
const app = express();

app.use(bodyParser.json());
app.use(morgan('dev'));

const messages = new Map();

const secondaryHosts = ['http://localhost:8081', 'http://localhost:8082'];

app.post('/message', async (req, res) => {
  const newMessageId = uuid.v4();

  function replicateMessageToSecondary(host, message) {
    const url = `${host}/message`;
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify(message);

    return fetch(url, { method: 'POST', headers, body });
  }

  const replicationRequestPromises = [];
  for (const secondaryHost of secondaryHosts) {
    const replicationRequestPromise = replicateMessageToSecondary(
      secondaryHost,
      { id: newMessageId, message: req.body.message },
    );
    replicationRequestPromises.push(replicationRequestPromise);
  }

  try {
    await Promise.all(replicationRequestPromises);
    messages.set(newMessageId, req.body.message);
    res.status(200).send('OK');
  } catch (e) {
    res.status(500).send({ error: e });
  }
});

app.get('/messages', (_, res) => {
  res.status(200).send({ messages: [...messages.values()] });
});

app.listen(PORT, () => {
  console.log(`MAIN is listening on port ${PORT}`);
});
