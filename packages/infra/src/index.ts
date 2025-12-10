/**
 * Engram Infrastructure
 *
 * This is the main entry point for Pulumi infrastructure deployment.
 * Infrastructure is organized into logical modules:
 *
 * - config.ts: Centralized configuration and constants
 * - network.ts: VPC, subnets, NAT configuration
 * - gke.ts: GKE Autopilot cluster
 * - secrets.ts: Secret Manager secrets
 *
 * Note: Data plane services (FalkorDB, Qdrant, Redpanda) are deployed
 * via Helm charts after the cluster is provisioned. See k8s/ directory
 * for Helm values files.
 */

// Re-export network resources
export { network, subnet, router, nat } from "./network";

// Re-export GKE resources
export { cluster, kubeconfig } from "./gke";

// Re-export secrets
export { openaiApiKeySecret, anthropicApiKeySecret, xaiApiKeySecret } from "./secrets";

// Re-export configuration for reference
export { gcpProject, gcpRegion, environment, commonLabels } from "./config";
