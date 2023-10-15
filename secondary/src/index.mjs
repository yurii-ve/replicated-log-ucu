import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';

const PORT = process.env.PORT ?? 8080;
const app = express();

app.use(bodyParser.json());
app.use(morgan('dev'));

const messages = new Map();

app.post('/message', (req, res) => {
  // simulate 2 seconds delay to test that replication is blocking
  setTimeout(() => {
    messages.set(req.body.id, req.body.message);
    res.status(200).send('OK');
  }, 2000);
});

app.get('/messages', (_, res) => {
  res.status(200).send({ messages: [...messages.values()] });
});

app.listen(PORT, () => {
  console.log(`SECONDARY is listening on port ${PORT}`);
});
