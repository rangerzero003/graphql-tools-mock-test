import { buildSchema } from "graphql";
import { addMocksToSchema, createMockStore, MockStore } from "@graphql-tools/mock";
import { beforeAll, describe, expect, it } from "@jest/globals"
import { uuidv4 } from "@graphql-tools/mock/utils";
import { createYoga } from "graphql-yoga";

function yogaRequest(yoga: any, query: string, variables: Record<string, any>) {
  const response = yoga.fetch('http://yoga/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

const typeDefs = /* GraphQL */ `
  type Query {
    user(id: String!): User
  }

  type Mutation {
    updateUser(id: String!, input: UpdateUserInput!): UserPayload
  }

  type User {
    id: String!
    name: String!
    email: String
  }

  type UserPayload {
    user: User!
  }

  input UpdateUserInput {
    name: String
    email: String
  }
`;

const schema = buildSchema(typeDefs);

describe("MockStore Test from documentation", () => {
  const mockStore = createMockStore({
    schema,
    mocks: {
      User: () => ({
        id: "1",
        name: "New User",
        email: null,
      }),
    }
  });

  const mockSchema = addMocksToSchema({
    schema,
    store: mockStore,
    resolvers: {
      Query: {
        user: (_: any, { id }: { id: string }) => mockStore.get("User", id),
      },
      Mutation: {
        updateUser: (_: any, { id, input }: { id: string, input: { name: string, email: string } }) => {
          mockStore.set("User", id, {
            ...input,
          });
          return {
            user: mockStore.get("User", id)
          };
        },
      },
    },
  });

  const yoga = createYoga({
    schema: mockSchema,
  });

  it("should generate a mock user from the mock User definition", async () => {
    const query = /* GraphQL */ `
      query User($userId: String!) {
        user (id: $userId) {
          id
          name
          email
        }
      }
    `;
    const response = await yogaRequest(yoga, query, { userId: "1" });
    expect(response).toEqual({
      data: {
        user: {
          id: "1",
          name: "New User",
          email: null,
        },
      },
    });
  });

  it("should return same value as previous call with same id", async () => {
    const query = /* GraphQL */ `
      query User($userId: String!) {
        user (id: $userId) {
          id
          name
          email
        }
      }
    `;
    const response = await yogaRequest(yoga, query, { userId: "1" });
    expect(response).toEqual({
      data: {
        user: {
          id: "1",
          name: "New User",
          email: null,
        },
      },
    });
  });

  it("should update the user and return the updated user", async () => {
    const query = /* GraphQL */ `
      mutation UpdateUser($userId: String!, $input: UpdateUserInput!) {
        updateUser(id: $userId, input: $input) {
          user {
            id
            name
            email
          }
        }
      }
    `;
    const response = await yogaRequest(yoga, query, { userId: "1", input: { name: "Updated User", email: "updated@user.com" } });
    expect(response).toEqual({
      data: {
        updateUser: {
          user: {
            id: "1",
            name: "Updated User",
            email: "updated@user.com",
          },
        },
      },
    });
  });

  it("should return the updated user when calling the query after the update mutation", async () => {
    const query = /* GraphQL */ `
      query User($userId: String!) {
        user (id: $userId) {
          id
          name
          email
        }
      }
    `;
    const response = await yogaRequest(yoga, query, { userId: "1" });
    expect(response).toEqual({
      data: {
        user: {
          id: "1",
          name: "Updated User",
          email: "updated@user.com",
        },
      },
    });
  })
});

