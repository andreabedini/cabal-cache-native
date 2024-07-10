import { exec } from "@actions/exec";

export { exec };

export async function execWithOutput(command: string, args: string[]) {
  let myOutput = "";
  await exec(command, args, {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        myOutput += data.toString();
      },
    },
  });
  return myOutput;
}
