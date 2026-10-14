import { exec, ExecOptions } from "@actions/exec";

export { exec };

// Runs a command and returns its standard output. If the command fails, the
// error includes its standard error.
export async function execWithOutput(
  command: string,
  args: string[],
  options: ExecOptions = {},
): Promise<string> {
  let stdout = "";
  let stderr = "";
  const exitCode = await exec(command, args, {
    ...options,
    silent: true,
    ignoreReturnCode: true,
    listeners: {
      stdout: (data: Buffer) => {
        stdout += data.toString();
      },
      stderr: (data: Buffer) => {
        stderr += data.toString();
      },
    },
  });
  if (exitCode !== 0) {
    throw Error(
      `'${command} ${args.join(" ")}' failed with exit code ${exitCode}:\n${stderr}`,
    );
  }
  return stdout;
}
