import * as pulumi from "@pulumi/pulumi";

/**
 * Engram Infrastructure Configuration
 *
 * This module provides centralized configuration for all infrastructure resources.
 * Values are loaded from Pulumi stack configuration with sensible defaults.
 */

const config = new pulumi.Config();
const gcpConfig = new pulumi.Config("gcp");

// GCP Configuration
export const gcpProject = gcpConfig.require("project");
export const gcpRegion = gcpConfig.get("region") ?? "us-central1";

// Environment
export const environment = pulumi.getStack();

// Network Configuration
export const networkConfig = {
	cidrRange: config.get("networkCidr") ?? "10.0.0.0/16",
};

// GKE Configuration
export const gkeConfig = {
	// Disable deletion protection for non-production environments
	deletionProtection: environment === "prod",
};

// Common Tags
export const commonLabels = {
	project: "engram",
	environment: environment,
	managedBy: "pulumi",
};
