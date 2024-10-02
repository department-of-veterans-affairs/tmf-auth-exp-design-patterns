const { Octokit } = await import("@octokit/rest");

const ORG_NAME = process.env.ORG_NAME;
const REPO_NAME = process.env.REPO_NAME;
const PROJECT_NUMBER = parseInt(process.env.PROJECT_NUMBER);
const ISSUE_NUMBER = parseInt(process.env.ISSUE_NUMBER);

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function updateIssuePriority() {
  try {
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

    const { repository } = await octokit.graphql(`
      query($owner: String!, $repo: String!, $number: Int!, $projectId: ID!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            projectV2Items(first: 1, projectId: $projectId) {
              nodes {
                id
              }
            }
          }
        }
      }
    `, {
      owner: ORG_NAME,
      repo: REPO_NAME,
      number: ISSUE_NUMBER,
      projectId: project.id
    });

    const projectItem = repository.issue.projectV2Items.nodes[0];

    if (!projectItem) {
      console.log("Issue not found in the project");
      return;
    }

    console.log(`Found issue in project with item ID: ${projectItem.id}`);

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
    process.exit(1);
  }
}

updateIssuePriority();