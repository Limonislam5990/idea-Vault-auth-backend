const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("ideaVaultDB");
const ideasCollection = db.collection("ideas");

const toId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const IDEA_FIELDS = [
  "title", "shortDescription", "detailedDescription", "category", "tags",
  "imageUrl", "budget", "targetAudience", "problemStatement", "proposedSolution",
];

const pickIdeaFields = (body = {}) => {
  const out = {};
  for (const key of IDEA_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
};

app.get("/", (req, res) => {
  res.send("IdeaVault server is running...");
});

// Home page: latest 6 ideas
app.get("/trending-ideas", async (req, res) => {
  const result = await ideasCollection.find().sort({ createdAt: -1 }).limit(6).toArray();
  res.send(result);
});

// All ideas. Optional: ?search=..&category=..&email=..
app.get("/ideas", async (req, res) => {
  const { search, category, email } = req.query;
  const query = {};

  if (search) query.title = { $regex: escapeRegex(String(search)), $options: "i" };
  if (category && category !== "All") query.category = category;
  if (email) query.userEmail = email;

  const result = await ideasCollection.find(query).sort({ createdAt: -1 }).toArray();
  res.send(result);
});

// Ideas the given user has commented on: /my-interactions?email=..
app.get("/my-interactions", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.send([]);
  const result = await ideasCollection
    .find({ "comments.userEmail": email })
    .sort({ createdAt: -1 })
    .toArray();
  res.send(result);
});

app.get("/ideas/:id", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });
  const result = await ideasCollection.findOne({ _id });
  if (!result) return res.status(404).send({ message: "Idea not found" });
  res.send(result);
});

app.post("/ideas", async (req, res) => {
  const body = req.body || {};
  const newIdea = {
    ...pickIdeaFields(body),
    userEmail: body.userEmail || "",
    userName: body.userName || "",
    userPhoto: body.userPhoto || "",
    comments: [],
    createdAt: new Date().toISOString(),
  };

  if (!newIdea.title || !newIdea.shortDescription) {
    return res.status(400).send({ message: "title and shortDescription are required" });
  }

  const result = await ideasCollection.insertOne(newIdea);
  res.status(201).send(result);
});

app.put("/ideas/:id", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });
  const result = await ideasCollection.updateOne({ _id }, { $set: pickIdeaFields(req.body) });
  res.send(result);
});

app.delete("/ideas/:id", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });
  const result = await ideasCollection.deleteOne({ _id });
  res.send(result);
});

// ----- Comments -----
app.post("/ideas/:id/comments", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });

  const { text, userName, userEmail, userPhoto } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).send({ message: "Comment text is required" });
  }

  const comment = {
    id: new ObjectId().toString(),
    text: String(text).trim(),
    userName: userName || "Anonymous",
    userEmail: userEmail || "",
    userPhoto: userPhoto || "",
    createdAt: new Date().toISOString(),
  };

  const result = await ideasCollection.updateOne({ _id }, { $push: { comments: comment } });
  if (!result.matchedCount) return res.status(404).send({ message: "Idea not found" });
  res.status(201).send({ ...result, comment });
});

app.put("/ideas/:id/comments/:commentId", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });

  const { text, userEmail } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).send({ message: "Comment text is required" });
  }

  const result = await ideasCollection.updateOne(
    { _id, comments: { $elemMatch: { id: req.params.commentId, userEmail } } },
    { $set: { "comments.$.text": String(text).trim() } }
  );
  if (!result.matchedCount) {
    return res.status(403).send({ message: "Comment not found or not yours" });
  }
  res.send(result);
});

app.delete("/ideas/:id/comments/:commentId", async (req, res) => {
  const _id = toId(req.params.id);
  if (!_id) return res.status(400).send({ message: "Invalid idea id" });

  const { email } = req.query;
  const result = await ideasCollection.updateOne(
    { _id, comments: { $elemMatch: { id: req.params.commentId, userEmail: email } } },
    { $pull: { comments: { id: req.params.commentId } } }
  );
  if (!result.matchedCount) {
    return res.status(403).send({ message: "Comment not found or not yours" });
  }
  res.send(result);
});

// JSON error handler (instead of an HTML error page)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send({ message: "Server error", error: err.message });
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
