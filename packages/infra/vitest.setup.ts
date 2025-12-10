/**
 * Vitest Setup for Pulumi Infrastructure Tests
 *
 * This file runs before any tests to initialize Pulumi mocks and configuration.
 * Pulumi requires mocks to be set up before any infrastructure modules are imported,
 * otherwise Config.require() will fail.
 */

import { initPulumiTest } from "./src/testing";

// Initialize Pulumi testing environment
initPulumiTest();
