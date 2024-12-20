import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Menghubungkan dengan schema User
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Chat bisa diarahkan ke user tertentu
      required: false, // Tidak wajib jika pesan global
    },
    message: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true } // Tambahkan timestamps untuk createdAt dan updatedAt otomatis
);

export default mongoose.model("Message", messageSchema);
