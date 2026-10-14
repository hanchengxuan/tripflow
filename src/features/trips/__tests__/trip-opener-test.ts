import { createTripOpener } from '../trip-opener';

function setup() {
  const pending = jest.fn();
  const opened = jest.fn();
  const failed = jest.fn();
  const opener = createTripOpener(pending);
  const blur = opener.focus();
  let resolve: () => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const select = jest.fn(() => new Promise<void>((yes, no) => { resolve = yes; reject = no; }));
  return { opener, blur, select, pending, opened, failed, resolve: () => resolve(), reject: () => reject(new Error('selection failed')) };
}

test('leaving and returning before selection completes never opens the old panel', async () => {
  const t = setup();
  const work = t.opener.open('b', 'a', t.select, t.opened, t.failed);
  t.blur();
  t.opener.focus();
  t.resolve();
  await work;
  expect(t.opened).not.toHaveBeenCalled();
  expect(t.pending).toHaveBeenLastCalledWith(undefined);
});
test('another panel supersedes pending trip management', async () => {
  const t = setup();
  const work = t.opener.open('b', 'a', t.select, t.opened, t.failed);
  t.opener.cancel();
  t.resolve();
  await work;
  expect(t.opened).not.toHaveBeenCalled();
});
test('repeated taps do not start competing selections', async () => {
  const t = setup();
  const work = t.opener.open('b', 'a', t.select, t.opened, t.failed);
  await t.opener.open('c', 'a', t.select, t.opened, t.failed);
  expect(t.select).toHaveBeenCalledTimes(1);
  t.resolve();
  await work;
  expect(t.opened).toHaveBeenCalledTimes(1);
});
test('a failed selection reports the error without opening management', async () => {
  const t = setup();
  const work = t.opener.open('b', 'a', t.select, t.opened, t.failed);
  t.reject();
  await work;
  expect(t.failed).toHaveBeenCalledTimes(1);
  expect(t.opened).not.toHaveBeenCalled();
});
