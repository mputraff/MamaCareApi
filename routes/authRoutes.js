// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Message from "../models/Message.js";
import authenticateToken from "../middleware/authenticateToken.js";
import dotenv from "dotenv";
dotenv.config();
import { Storage } from "@google-cloud/storage";


const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 1024 * 1024 * 5,
  },

  fileFilter(req, file, cb) {
    console.log("File upload attempt:", file);
    if (!file.mimetype.startsWith("image/")) {
      console.log("Invalid file type:", file.mimetype)
      return cb(new Error("Please upload an image file"));
    }
    cb(null, true);
  },
});

const googleCredentials = JSON.parse(
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
);

const storage = new Storage({
  credentials: googleCredentials,
});

const bucket = storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);

router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({
      status: "success",
      message: "User registered successfully",
      data: {
        id: user._id, // Mengakses _id setelah user disimpan
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error during registration:", error); // Menampilkan error di console log
    res.status(500).json({ error: "Error registering user" });
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { id: user.id, name: user.name },
        process.env.JWT_SECRET,
        { expiresIn: "1h" } // Token akan kedaluwarsa dalam 1 jam
      );

      res.json({
        status: "success",
        message: "Login successfully",
        token,
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          profilePicture: user.profilePicture,
        },
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.log("Error during login:", error);
    res.status(500).json({ error: "Error logging in" });
  }
});

router.patch(
  "/edit-profile",
  authenticateToken,
  upload.single("profilePicture"),
  async (req, res) => {
    const { name, email, password } = req.body;
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        console.log("User not found");
        return res.status(404).json({ error: "User not found" });
      }
      console.log("User found", user);

      // Flag untuk mengecek apakah ada perubahan
      let isUpdated = false;

      // Update name, email, and password if provided
      if (name) {
        user.name = name;
        isUpdated = true;
      }
      if (email) {
        user.email = email;
        isUpdated = true;
      }
      if (password) {
        user.password = await bcrypt.hash(password, 10);
        isUpdated = true;
      }

      // If there's a profile picture, upload it to Google Cloud Storage
      if (req.file) {
        const blob = bucket.file(
          `profilePictures/${Date.now()}_${req.file.originalname}`
        );
        const blobStream = blob.createWriteStream({
          resumable: false,
          contentType: req.file.mimetype,
        });

        blobStream.on("error", (err) => {
          console.error("Error uploading file:", err);
          return res.status(500).json({ error: "Error uploading file" });
        });

        blobStream.on("finish", async () => {
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
          user.profilePicture = publicUrl; // Save the URL in the database
          console.log("Profile picture updated.");
          await user.save();
          console.log("User profile updated successfully.");
          res.json({
            message: "User profile updated successfully",
            data: {
              name: user.name,
              email: user.email,
              profilePicture: publicUrl,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
            }
          });
        });

        blobStream.end(req.file.buffer); // End the stream
      } else if (isUpdated) {
        // Jika ada perubahan tetapi tidak ada foto yang diupload
        await user.save();
        console.log("User profile updated successfully without new picture.");
        res.json({ message: "User profile updated successfully" });
      } else {
        // Jika tidak ada perubahan sama sekali
        res.json({ message: "No changes made to the profile." });
      }
    } catch (error) {
      console.log("Error updating profile:", error);
      res.status(500).json({ error: "Error updating profile" });
    }
  }
);

router.post("/send-message", async (req, res) => {
  const { senderId, message } = req.body;

  try {
    const newMessage = new Message({
      sender: senderId,
      receiver: null, // null untuk pesan global
      message,
    });

    await newMessage.save();

    // Emit pesan baru ke semua client
    req.io.emit("updateMessages", {
      content: newMessage.message,
      senderName: newMessage.sender.name,
      senderProfilePicture: newMessage.sender.profilePicture,
      timestamp: newMessage.createdAt,
    });

    res.status(201).json({ message: "Message sent successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message", details: err });
  }
});


router.get("/get-messages", async (req, res) => {
  try {
    const messages = await Message.find().populate("sender", "name photo"); // Populate untuk mendapatkan data user
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages", details: err });
  }
});

export default router;
