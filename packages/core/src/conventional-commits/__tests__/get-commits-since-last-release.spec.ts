jest.mock('../../utils/describe-ref');
jest.mock('../../child-process');
jest.mock('../get-github-commits');

import { getGithubCommits } from '../get-github-commits';
import { describeRefSync } from '../../utils/describe-ref';
import { getCommitsSinceLastRelease, getOldestCommitSinceLastTag } from '../get-commits-since-last-release';
import { execSync } from '../../child-process';

const execOpts = { cwd: '/test' };
const tagStub = {
  lastTagName: 'v1.0.0',
  lastVersion: '1.0.0',
  refCount: '1',
  sha: 'deadbeef',
  isDirty: false,
};
const commitsStub = [
  {
    authorName: 'Tester McPerson',
    login: 'tester-mcperson',
    shortHash: 'SHA',
    message: 'fix(stuff): changed something',
  },
];

describe('getCommitsSinceLastRelease', () => {
  beforeEach(() => {
    (describeRefSync as jest.Mock).mockReturnValue(tagStub);
    (execSync as jest.Mock).mockReturnValue('"deadbeef 2022-07-01T00:01:02-04:00"');
  });

  it('throws an error if used with a remote client other than "github"', async () => {
    await expect(getCommitsSinceLastRelease('gitlab', 'durable', 'main', execOpts)).rejects.toThrow(
      'Invalid remote client type, "github" is currently the only supported client with the option --changelog-include-commits-client-login.'
    );
  });

  it('should expect commits returned when using "github" when a valid tag is returned', async () => {
    (getGithubCommits as jest.Mock).mockResolvedValue(commitsStub);
    const result = await getCommitsSinceLastRelease('github', 'durable', 'main', execOpts);

    expect(result).toEqual(commitsStub);
  });
});

describe('getOldestCommitSinceLastTag', () => {
  describe('without tag', () => {
    beforeEach(() => {
      (describeRefSync as jest.Mock).mockReturnValue({
        lastTagName: undefined,
        lastVersion: undefined,
        refCount: '1',
        sha: 'deadbeef',
        isDirty: false,
      });
      (execSync as jest.Mock).mockReturnValue('"deadbeef 2022-07-01T00:01:02-04:00"');
    });

    it('should return first commit date when describeRefSync() did not return a tag date', async () => {
      const execSpy = (execSync as jest.Mock).mockReturnValueOnce('"abcbeef 2022-07-01T00:01:02-04:00"');
      const result = await getOldestCommitSinceLastTag(execOpts);

      expect(execSpy).toHaveBeenCalledWith(
        'git',
        ['log', '--oneline', '--format="%h %aI"', '--reverse', '--max-parents=0', 'HEAD'],
        execOpts
      );
      expect(result).toEqual({ commitDate: '2022-07-01T00:01:02-04:00', commitHash: 'abcbeef' });
    });
  });

  describe('with existing tag', () => {
    beforeEach(() => {
      (describeRefSync as jest.Mock).mockReturnValue(tagStub);
    });

    it('should expect a result with a tag date, hash and ref count', async () => {
      const execSpy = (execSync as jest.Mock)
        .mockReturnValueOnce('')
        .mockReturnValueOnce('"deedbeaf 2022-07-01T00:01:02-04:00"');

      const result = await getOldestCommitSinceLastTag(execOpts);

      expect(execSpy).toHaveBeenCalledWith('git', ['log', 'v1.0.0..HEAD', '--format="%h %aI"', '--reverse'], execOpts);
      expect(execSpy).toHaveBeenCalledWith('git', ['log', '-1', '--format="%h %aI"', 'v1.0.0'], execOpts);
      expect(result).toEqual({ commitDate: '2022-07-01T00:01:02-04:00', commitHash: 'deedbeaf' });
    });

    it('should expect a result with a tag date, hash and ref count', async () => {
      const result = await getOldestCommitSinceLastTag(execOpts);
      const execSpy = (execSync as jest.Mock).mockReturnValueOnce('"deadbeef 2022-07-01T00:01:02-04:00"');

      expect(execSpy).toHaveBeenCalledWith('git', ['log', 'v1.0.0..HEAD', '--format="%h %aI"', '--reverse'], execOpts);
      expect(result).toEqual({ commitDate: '2022-07-01T00:01:02-04:00', commitHash: 'deadbeef' });
    });
  });
});