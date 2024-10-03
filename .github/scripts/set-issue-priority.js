import { Octokit } from '@octokit/rest';

const ORG_NAME = process.env.ORG_NAME;
const REPO_NAME = process.env.REPO_NAME;
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER);
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER);

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function updateIssuePriority() {
  try {
    // 1. Get the project (board) ID and fields using GraphQL
    const { organization } = await octokit.graphql(`
      query($org: String!, $projectNumber: Int!) {
        organization(login: $org) {
          projectV2(number: $projectNumber) {
            id
            fields(first: 20) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
            items(first: 100, orderBy: {field: POSITION, direction: DESC}) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                    repository {
                      nameWithOwner
                    }
                  }
                }
              }
            }
          }
        }
      }
    `, {
      org: ORG_NAME,
      projectNumber: PROJECT_NUMBER
    });

    const project = organization.projectV2;
    console.log(`Found project with ID: ${project.id}`);

    const priorityField = project.fields.nodes.find(field => field.name === "Priority");
    if (!priorityField) {
      console.log("Priority field not found in the project");
      return;
    }

    const normalOption = priorityField.options.find(option => option.name.toLowerCase() === "normal");
    if (!normalOption) {
      console.log("Normal priority option not found");
      return;
    }

    console.log(`Found "Normal" priority option with ID: ${normalOption.id}`);

    const projectItem = project.items.nodes.find(item => {
      console.log({ item });
      return item.content && item.content.number === ISSUE_NUMBER &&  item.content.repository.nameWithOwner === `${ORG_NAME}/${REPO_NAME}`;
    }
    );

    if (!projectItem) {
      console.log("Issue not found in the project");
      return;
    }

    console.log(`Found issue in project with item ID: ${projectItem.id}`);

    // 4. Update the Priority field for the issue in the project
    const result = await octokit.graphql(`
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(
          input: {
            projectId: $projectId,
            itemId: $itemId,
            fieldId: $fieldId,
            value: {
              singleSelectOptionId: $optionId
            }
          }
        ) {
          projectV2Item {
            id
          }
        }
      }
    `, {
      projectId: project.id,
      itemId: projectItem.id,
      fieldId: priorityField.id,
      optionId: normalOption.id
    });

    console.log("Issue priority successfully updated to 'Normal'");
    console.log("Result:", result);

  } catch (error) {
    console.error("Error:", error.message);
    if (error.request) {
      console.error("GraphQL query:", error.request.query);
      console.error("Variables:", error.request.variables);
    }
  }
}

updateIssuePriority();