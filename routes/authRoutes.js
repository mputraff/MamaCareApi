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
    // const otp = Math.floor(1000 + Math.random() * 9000); // 6-digit OTP
    // const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = new User({
      name,
      email,
      password: hashedPassword,
    //   otp,
    //   otpExpires,
    });

    await user.save();

    // const transporter = nodemailer.createTransport({
    //   host: "mail.aicade.my.id",
    //   port: 465,
    //   secure: true,
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.PASS_USER,
    //   },
    //   debug: true, // Add this line for detailed logging
    //   logger: true,
    // });

    // const htmlContent = `
    //   <div style="font-family: Arial, sans-serif; color: #333;">
    //     <div style="background-color: #f7f7f7; padding: 20px; text-align: center;">
    //       <img src="../img/LogoAIcademy.png" alt="Loket Logo" style="width: 150px; height: auto;">
    //     </div>
    //     <div style="padding: 20px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px;">
    //       <p>Hi ${name},</p>
    //       <p>Tinggal selangkah lagi untuk menyelesaikan proses, mohon konfirmasi dengan memasukkan kode OTP di bawah ini.</p>
    //       <div style="text-align: center; font-size: 24px; font-weight: bold; padding: 20px; background-color: #f1f1f1; border-radius: 5px;">
    //         ${otp}
    //       </div>
    //       <p style="color: #666;">Kode ini hanya berlaku selama 10 menit. Jangan pernah membagikan kode OTP kepada siapa pun!</p>
    //       <p>Jika ada pertanyaan atau membutuhkan bantuan, silakan hubungi call center kami di +62 821-1723-6590 atau melalui email di <a href="cs@aicade.my.id" style="color: #1a73e8;">cs@aicade.my.id</a>.</p>
    //     </div>
    //   </div>
    // `;

    // await transporter.sendMail({
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: "Welcome to AIcademy",
    //   html: htmlContent,
    // });

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
          password: user.password,
          createdAt: user.createdAt,
          updateAt: user.updateAt,
        },
      });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
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


// router.post("/verify-otp", async (req, res) => {
//   const { email, otp } = req.body;
//   try {
//     // Find the user by email
//     const user = await User.findOne({ email });

//     if (!user) {
//       return res.status(400).json({ error: "User not found" });
//     }

//     if (user.otp !== otp || user.otpExpires < Date.now()) {
//       return res.status(400).json({ error: "Invalid or expired OTP" });
//     }

//     // Mark the user as verified
//     user.isVerified = true;
//     user.otp = null; // Clear OTP
//     user.otpExpires = null; // Clear OTP expiry
   
//     await user.save();

//     res.status(200).json({ message: "OTP verified successfully" });
//   } catch (error) {
//     console.error("Error during OTP verification:", error);
//     res.status(500).json({ error: "Error verifying OTP" });
//   }
// });

export default router;
