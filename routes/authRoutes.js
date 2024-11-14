// routes/auth.js
import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import authenticateToken from "../middleware/authenticateToken.js";

const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 1024 * 1024 * 5,
  },

  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Please upload an image file"));
    }
    cb(null, true);
  },
});


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
      message:
        "User registered successfully",
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
        console.log("user tidak ditemukan");
        return res.status(404).json({ error: "User not found" });
      }
      console.log("User ditemukan", user);

      // Update nama, email, dan password jika diberikan
      if (name) user.name = name;
      if (email) user.email = email;
      if (password) user.password = await bcrypt.hash(password, 10);

      // Jika ada file foto profil, simpan ke database
      if (req.file) {
        user.profilePicture = req.file.buffer;
        console.log("Foto profil diperbarui.");
      }

      await user.save();
      console.log("Profil user berhasil diperbarui.");
      res.json({ message: "User profile updated successfully" });
    } catch (error) {
      console.log("Error saat memperbarui .", error);
      res.status(500).json({ error: "Error updating profile" });
    }
  }
);

export default router;
