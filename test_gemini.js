const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testModel(modelName, key) {
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("hello");
    console.log(`[SUCCESS] ${modelName}:`, result.response.text().trim());
  } catch (err) {
    console.log(`[FAILED] ${modelName}:`, err.message);
  }
}

async function main() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { console.error("No key"); return; }
  
  await testModel("gemini-1.5-flash", key);
  await testModel("gemini-2.0-flash", key);
  await testModel("gemini-2.0-flash-lite", key);
  await testModel("gemini-2.5-flash", key);
  await testModel("gemini-pro", key);
}
main();
