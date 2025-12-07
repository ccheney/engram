import { auth } from "@clerk/nextjs/server";

export const checkRole = async (role: string) => {
	const { sessionClaims } = await auth();
	// @ts-expect-error - Clerk types need config
	if (sessionClaims?.metadata?.role !== role) {
		throw new Error("Forbidden");
	}
};
