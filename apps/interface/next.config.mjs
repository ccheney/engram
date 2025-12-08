/** @type {import('next').NextConfig} */
const nextConfig = {
	serverExternalPackages: [
		"@huggingface/transformers",
		"onnxruntime-node",
		"sharp",
		"pino",
		"pino-pretty",
		"thread-stream",
		"sonic-boom",
		"@confluentinc/kafka-javascript",
	],
};

export default nextConfig;
