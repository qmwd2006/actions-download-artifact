const core = require('@actions/core')
const github = require('@actions/github')
const AdmZip = require('adm-zip')
const filesize = require('filesize')
const pathname = require('path')
const fs = require('fs')

async function main() {
    try {
        const token = core.getInput("github_token", { required: true })
        const workflow = core.getInput("workflow", { required: true })
        const [owner, repo] = core.getInput("repo", { required: true }).split("/")
        const path = core.getInput("path", { required: true })
        const name = core.getInput("name")
        let workflowConclusion = core.getInput("workflow_conclusion")
        let pr = core.getInput("pr")
        let commit = core.getInput("commit")
        let branch = core.getInput("branch")
        let event = core.getInput("event")
        let runID = core.getInput("run_id")
        let runNumber = core.getInput("run_number")

        const client = github.getOctokit(token)

        console.log("==> Repo:", owner + "/" + repo)

        let artifacts = await client.actions.listArtifactsForRepo({
            owner: owner,
            repo: repo,
        })

        // One artifact or all if `name` input is not specified.
        if (name) {
            artifacts = artifacts.data.artifacts.filter((artifact) => {
                return artifact.name.indexOf(name) === 0
            })
        } else {
            artifacts = artifacts.data.artifacts
        }

        if (artifacts.length == 0)
            throw new Error("no artifacts found")

        for (const artifact of artifacts) {
            console.log("==> Artifact:", artifact.id)

            const size = filesize(artifact.size_in_bytes, { base: 10 })

            if (artifact.size_in_bytes > 1.5 * 1024 * 1024 * 1024) {
                console.log(`==> Size to big, skip it: ${artifact.name}.zip (${size})`)
                continue;
            }

            console.log(`==> Downloading: ${artifact.name}.zip (${size})`)

            const zip = await client.actions.downloadArtifact({
                owner: owner,
                repo: repo,
                artifact_id: artifact.id,
                archive_format: "zip",
            })

            const dir = name ? path : pathname.join(path, artifact.name)

            fs.mkdirSync(dir, { recursive: true })

            const adm = new AdmZip(Buffer.from(zip.data))

            adm.getEntries().forEach((entry) => {
                const action = entry.isDirectory ? "creating" : "inflating"
                const filepath = pathname.join(dir, entry.entryName)

                console.log(`  ${action}: ${filepath}`)
            })

            adm.extractAllTo(dir, true)

            break
        }
    } catch (error) {
        core.setFailed(error.message)
    }
}

main()
