import type { Queue } from "@syncploy/sdk";

declare module "@syncploy/sdk" {
  export interface ApiOptions {
    roleLogicalId?: string;
    permissionLogicalId?: string;
  }

  export interface ConsumerOptions {
    eventSourceMappingLogicalId?: string;
    mappingLogicalId?: string;
    roleLogicalId?: string;
  }

  export interface TableStreamOptions {
    eventSourceMappingLogicalId?: string;
    mappingLogicalId?: string;
    roleLogicalId?: string;
  }

  export interface TopicSubscriberOptions {
    subscriptionLogicalId?: string;
    permissionLogicalId?: string;
    roleLogicalId?: string;
  }

  export interface DeliveryStreamOptions {
    roleLogicalId?: string;
  }

  export interface Bucket {
    on(
      event: "objectCreated" | "objectRemoved",
      target: Queue,
      options?: {
        prefix?: string;
        suffix?: string;
        ruleLogicalId?: string;
        queuePolicyLogicalId?: string;
      }
    ): void;
  }
}

export {};
