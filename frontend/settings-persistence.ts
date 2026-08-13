export async function persistSettingWithReadback<T>(
  write: (value: T) => Promise<void>,
  read: () => Promise<T>,
  value: T,
): Promise<void> {
  try {
    await write(value);
  } catch (writeError) {
    // Millennium 3.4 can persist a config value and then reject while parsing
    // an empty IPC acknowledgement. Treat a matching readback as success.
    try {
      if (Object.is(await read(), value)) return;
    } catch {
      // Preserve the original write error; it is the actionable failure.
    }
    throw writeError;
  }
}
