import express from 'express';
import { chatRepository } from '../repositories/chatRepository.js';

const router = express.Router();

router.get('/conversations/:jid/messages', async (req, res) => {
  const { jid } = req.params;
  const messages = await chatRepository.getMessagesByJid(jid);

  res.json({
    success: true,
    data: messages
  });
});

export default router;
