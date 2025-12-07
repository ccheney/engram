import { Kafka, Producer, Consumer } from 'kafkajs';

export class KafkaClient {
  private kafka: Kafka;
  private producer: Producer | null = null;

  constructor(brokers: string[] = ['localhost:9092'], clientId: string = 'soul-client') {
    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });
  }

  public async getProducer(): Promise<Producer> {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        idempotent: true,
        allowAutoTopicCreation: true,
      });
      await this.producer.connect();
    }
    return this.producer;
  }

  public async createConsumer(groupId: string): Promise<Consumer> {
    const consumer = this.kafka.consumer({ groupId });
    await consumer.connect();
    return consumer;
  }

  public async disconnect() {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }
}

export const createKafkaClient = (clientId: string) => {
  const brokers = (process.env.REDPANDA_BROKERS || 'localhost:9092').split(',');
  return new KafkaClient(brokers, clientId);
};
