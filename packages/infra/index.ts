import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

// Create a GCP Network
const network = new gcp.compute.Network("engram-network", {
	autoCreateSubnetworks: false,
});

const subnet = new gcp.compute.Subnetwork("engram-subnet", {
	ipCidrRange: "10.0.0.0/16",
	region: "us-central1",
	network: network.id,
});

// Create a GKE Autopilot Cluster
const cluster = new gcp.container.Cluster("engram-data-cluster", {
	location: "us-central1",
	network: network.name,
	subnetwork: subnet.name,
	enableAutopilot: true,
	deletionProtection: false, // For dev/demo purposes
});

// Secrets
const secretReplication = {
	auto: {},
};

const _openaiKey = new gcp.secretmanager.Secret("openai-api-key", {
	secretId: "openai-api-key",
	replication: secretReplication,
});

const _anthropicKey = new gcp.secretmanager.Secret("anthropic-api-key", {
	secretId: "anthropic-api-key",
	replication: secretReplication,
});

const _falkorPassword = new gcp.secretmanager.Secret("falkordb-password", {
	secretId: "falkordb-password",
	replication: secretReplication,
});

// Exports
export const networkName = network.name;
export const clusterName = cluster.name;
export const kubeconfig = pulumi
	.all([cluster.name, cluster.endpoint, cluster.masterAuth])
	.apply(([name, endpoint, masterAuth]) => {
		const context = `${gcp.config.project}_${gcp.config.zone}_${name}`;
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
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true
`;
	});
