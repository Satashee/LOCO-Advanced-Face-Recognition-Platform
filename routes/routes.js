const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const pool = require("../db/db");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const sharp = require("sharp");

const { getDescriptorsFromDB, uploadLabeledImages } = require("../utils/utils");

/////////////////////////GET ROUTES////////////////////////

//Fetch Userinfo

router.get("/fetchuserinfo", async (req, res) => {
  try {
    const userId = req.session.user.user_id; // Extract the user_id from the session object
    const query = "SELECT * FROM appuser WHERE user_id = $1";
    const values = [userId];
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Some issue occurred in Session" });
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Error Fetching Information:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Dashboard Route

router.get("/dashboardfetch", async (req, res) => {
  try {
    const userId = req.session.user.user_id; // Extract the user_id from the session object
    const query =
      "SELECT person_id, name, created_at, image_path FROM person where reported_by = $1";
    const values = [userId];
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ message: "Some issue occurred in Session" });
    }
    res.json(result.rows);
  } catch (error) {
    console.error("Error Fetching Information:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

/////////////////////////POST ROUTES////////////////////////

router.post("/check-face", upload.single("checkImg"), async (req, res) => {
  try {
    const uploadedFile = req.file; // Use req.file instead of req.files
    console.log("Uploaded File:", uploadedFile);

    if (!uploadedFile) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    let imagePath = uploadedFile.path;
    console.log(imagePath);

    // Ensure the image has an extension
    if (path.extname(imagePath) === "") {
      fs.renameSync(imagePath, imagePath + ".jpg");
      imagePath = imagePath + ".jpg";
    }

    const result = await getDescriptorsFromDB(imagePath);
    res.json({ result });

    // Delete the image after processing
    fs.unlinkSync(imagePath);
  } catch (error) {
    console.error("Error checking face:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});
router.post("/upload", upload.array("images", 10), (req, res) => {
  const { name } = req.body;
  const uploadedImages = req.files; // Array of uploaded files
  const fileExtension = path.extname(uploadedImages[0].originalname); // Assuming all images have the same extension

  // Split the user's name and use the first part for directory name
  const userDirectory = name;
  // Create a directory with the user's first name if it doesn't exist
  const userUploadsDir = path.join(__dirname, "../uploads", userDirectory);
  if (!fs.existsSync(userUploadsDir)) {
    fs.mkdirSync(userUploadsDir);
  }

  // Move and rename each uploaded image
  uploadedImages.forEach((uploadedImage, index) => {
    let newFilename = `${name}-${index + 1}${fileExtension}`;
    const newPath = path.join(userUploadsDir, newFilename);

    fs.renameSync(uploadedImage.path, newPath);

    // Process the uploaded image and associate it with the name
    // You would typically store this data in a database or data structure
    console.log(`Received image: ${name} (${newFilename})`);
  });
  res.json({ message: "Images uploaded successfully." });
});

router.post("/post-face", upload.array("images", 10), async (req, res) => {
  try {
    const { label } = req.body;
    const files = req.files;
    const userId = req.session.user.user_id; // Extract the user_id from the session object

    if (!label || !files || files.length === 0) {
      return res.status(400).json({ error: "Invalid request data" });
    }

    const imagePaths = files.map((file) => file.path);
    const uploadResult = await uploadLabeledImages(imagePaths, label, userId);

    if (uploadResult) {
      return res.json({ message: "Face data stored successfully" });
    } else {
      return res
        .status(500)
        .json({ error: "Something went wrong, please try again." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
