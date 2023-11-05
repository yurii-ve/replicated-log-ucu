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
  // to guarantee messages ordering
  messages.set(req.body.id, null);

  setTimeout(() => {
    messages.set(req.body.id, req.body.message);
    res.status(200).send('OK');
  }, TEST_DELAY_MS);
});

app.get('/messages', (_, res) => {
  const savedMessages = [...messages.values()].filter((msg) => msg !== null);
  res.status(200).send({ messages: savedMessages });
});

app.listen(PORT, () => {
  console.log(`SECONDARY is listening on port ${PORT}`);
});
