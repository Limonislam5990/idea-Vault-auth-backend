const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Successfully connected to MongoDB cluster instance.");
    
    const db = client.db("ideaVaultDB");
    const ideasCollection = db.collection("ideas");

    app.get("/trending-ideas", async (req, res) => {
      const result = await ideasCollection.find().limit(6).toArray();
      res.send(result);
    });

    app.get("/ideas", async (req, res) => {
      const { search, category } = req.query;
      let query = {};

      if (search) {
        query.title = { $regex: search, $options: "i" };
      }

      if (category && category !== "All") {
        query.category = category;
      }

      const result = await ideasCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/ideas/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ideasCollection.findOne(query);
      res.send(result);
    });

    app.post("/ideas", async (req, res) => {
      const newIdea = req.body;
      const result = await ideasCollection.insertOne(newIdea);
      res.status(201).send(result);
    });

    app.post("/ideas/:id/comments", async (req, res) => {
      const id = req.params.id;
      const { text } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $push: {
          comments: {
            text: text,
            createdAt: new Date()
          }
        }
      };
      const result = await ideasCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/ideas/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedIdea = req.body;
      const updateDoc = {
        $set: {
          title: updatedIdea.title,
          shortDescription: updatedIdea.shortDescription,
          detailedDescription: updatedIdea.detailedDescription,
          category: updatedIdea.category,
          tags: updatedIdea.tags,
          imageUrl: updatedIdea.imageUrl,
          budget: updatedIdea.budget,
          targetAudience: updatedIdea.targetAudience,
          problemStatement: updatedIdea.problemStatement,
          proposedSolution: updatedIdea.proposedSolution
        },
      };
      const result = await ideasCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/ideas/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ideasCollection.deleteOne(query);
      res.send(result);
    });

  } catch (error) {
    console.error("MongoDB connection breakdown:", error);
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('IdeaVault server is running...');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
