const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

const assetsPath = path.join(__dirname, '../src/assets');
const channelFile = path.join(assetsPath, 'channel.json');
const participantFile = path.join(assetsPath, 'channelParticipant.json');
const messageFile = path.join(assetsPath, 'channelMessage.json');

function readJson(filePath, fallback) {
  try {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (!existing) {
      return fallback;
    }
    const parsed = JSON.parse(existing);
    return parsed ?? fallback;
  } catch (err) {
    throw new Error(`Error reading ${path.basename(filePath)}: ${err.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

app.post('/addChannel', (req, res) => {
  try {
    const data = req.body;
    const jsonData = readJson(channelFile, []);
    const channels = Array.isArray(jsonData) ? jsonData : [];
    const maxId = channels.reduce((max, item) => Math.max(max, item.channelId || 0), 0);
    data.channelId = maxId + 1;
    channels.push(data);
    writeJson(channelFile, channels);
    res.status(200).json({ message: 'Channel saved', res: true, channel: data });
  } catch (err) {
    res.status(500).json({ message: 'Error adding channel: ' + err.message, res: false });
  }
});

app.post('/addParticipants', (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [req.body];
    const jsonData = readJson(participantFile, []);
    const participants = Array.isArray(jsonData) ? jsonData : [];
    let maxId = participants.reduce(
      (max, item) => Math.max(max, item.channelParticipantsId || 0),
      0
    );
    const created = incoming.map((item) => {
      maxId += 1;
      return { ...item, channelParticipantsId: maxId };
    });
    writeJson(participantFile, participants.concat(created));
    res.status(200).json({ message: 'Participants saved', res: true, participants: created });
  } catch (err) {
    res.status(500).json({ message: 'Error adding participants: ' + err.message, res: false });
  }
});

app.post('/createDirectChat', (req, res) => {
  try {
    const userId = Number(req.body.userId);
    const otherUserId = Number(req.body.otherUserId);
    if (!userId || !otherUserId || userId === otherUserId) {
      res.status(400).json({ message: 'Invalid users', res: false });
      return;
    }

    const channels = Array.isArray(readJson(channelFile, [])) ? readJson(channelFile, []) : [];
    const participants = Array.isArray(readJson(participantFile, []))
      ? readJson(participantFile, [])
      : [];

    const existingChannel = channels.find((channel) => {
      const members = participants
        .filter((p) => p.channelId === channel.channelId)
        .map((p) => p.userId);
      return (
        !channel.isGroup &&
        members.includes(userId) &&
        members.includes(otherUserId) &&
        members.length === 2
      );
    });

    if (existingChannel) {
      res.status(200).json({ message: 'Chat already exists', res: true, channel: existingChannel });
      return;
    }

    const channelId = channels.reduce((max, item) => Math.max(max, item.channelId || 0), 0) + 1;
    const channel = {
      channelId,
      channelName: 'Private Chat',
      isGroup: false,
      isAdmin: true,
      lastMessageContent: '',
      lastMessageDate: new Date().toISOString(),
    };
    channels.push(channel);

    let participantId = participants.reduce(
      (max, item) => Math.max(max, item.channelParticipantsId || 0),
      0
    );
    participants.push(
      {
        channelId,
        channelParticipantsId: ++participantId,
        userId,
        isAdmin: true,
        isActive: true,
      },
      {
        channelId,
        channelParticipantsId: ++participantId,
        userId: otherUserId,
        isAdmin: true,
        isActive: true,
      }
    );

    writeJson(channelFile, channels);
    writeJson(participantFile, participants);
    res.status(200).json({ message: 'Chat created', res: true, channel });
  } catch (err) {
    res.status(500).json({ message: 'Error creating chat: ' + err.message, res: false });
  }
});

app.post('/addMessage', (req, res) => {
  try {
    const data = req.body;
    const jsonData = readJson(messageFile, []);
    const messages = Array.isArray(jsonData) ? jsonData : [];
    const maxId = messages.reduce((max, item) => Math.max(max, item.channelMessageId || 0), 0);
    data.channelMessageId = maxId + 1;
    messages.push(data);
    writeJson(messageFile, messages);
    res.status(200).json({ message: 'Message saved successfully', res: true, data });
  } catch (err) {
    res.status(500).json({ message: 'Message not saved: ' + err.message, res: false });
  }
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
