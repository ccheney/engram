import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";
import { gcpProject, gcpRegion, gkeConfig } from "./config";
import { network, subnet } from "./network";

/**
 * Engram GKE Autopilot Cluster
 *
 * Creates a fully-managed GKE Autopilot cluster. Autopilot handles:
 * - Node provisioning and scaling
 * - Security hardening
 * - Optimized resource allocation
 */

export const cluster = new gcp.container.Cluster("engram-cluster", {
	location: gcpRegion,
	network: network.name,
	subnetwork: subnet.name,
	enableAutopilot: true,
	deletionProtection: gkeConfig.deletionProtection,
	description: "Engram services GKE Autopilot cluster",

	// Vertical Pod Autoscaling (enabled by default in Autopilot)
	verticalPodAutoscaling: {
		enabled: true,
	},

	// Release channel for automatic upgrades
	releaseChannel: {
		channel: "REGULAR",
	},
});

/**
 * Generate a kubeconfig for accessing the cluster.
 * Uses gke-gcloud-auth-plugin for authentication.
 */
export const kubeconfig = pulumi
	.all([cluster.name, cluster.endpoint, cluster.masterAuth])
	.apply(([name, endpoint, masterAuth]) => {
		const context = `gke_${gcpProject}_${gcpRegion}_${name}`;
		return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${masterAuth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: |
        Install gke-gcloud-auth-plugin for use with kubectl:
        gcloud components install gke-gcloud-auth-plugin
      provideClusterInfo: true
`;
	});
