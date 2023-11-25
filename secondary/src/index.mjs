import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

const PORT = process.env.PORT ?? 8080;
const TEST_DELAY_MS = process.env.TEST_DELAY_MS ?? 0;

const app = express();

app.use(bodyParser.json());
app.use(morgan('dev'));

const messages = new Map();

app.post('/message', (req, res) => {
  setTimeout(() => {
    messages.set(req.body.id, req.body.message);
    res.status(200).send('OK');
  }, TEST_DELAY_MS);
});

app.get('/messages', (_, res) => {
  const sortedKeys = [...messages.keys()].sort((a, b) => a - b);
  const savedMessages = sortedKeys
    .map((key) => messages.get(key))
    .filter((msg) => msg !== null);

  res.status(200).send({ messages: savedMessages });
});

app.listen(PORT, () => {
  console.log(`SECONDARY is listening on port ${PORT}`);
});
