import nock from 'nock'
import { ReadmeBox, UpdateSectionOpts } from '../src'
import * as fixtures from './fixtures'

function decode(string: string) {
  return Buffer.from(string, 'base64').toString('utf8')
}

describe('ReadmeBox', () => {
  let opts: UpdateSectionOpts
  let updateFileContentsUri: string
  let updateFileContentsParams: any
  let box: ReadmeBox

  beforeEach(() => {
    opts = {
      owner: 'andatoshiki',
      repo: 'readme-box',
      token: '123abc',
      section: 'example',
      branch: 'master'
    }

    box = new ReadmeBox(opts)

    nock('https://api.github.com')
      .get(`/repos/${opts.owner}/${opts.repo}/readme?ref=${opts.branch}`)
      .reply(200, fixtures.getReadme)
      .put(new RegExp(`/repos/${opts.owner}/${opts.repo}/contents/.*`))
      .reply(200, (uri, body) => {
        updateFileContentsUri = uri
        updateFileContentsParams = body
      })
  })

  afterEach(() => {
    nock.cleanAll()
    updateFileContentsParams = null
  })

  it('runs a test', () => {
    expect(box).toBeInstanceOf(ReadmeBox)
  })

  describe('.updateSection', () => {
    it('calls the API requests and updates the section of the README', async () => {
      await ReadmeBox.updateSection('New content!', opts)
      expect(nock.isDone()).toBe(true)
      expect(decode(updateFileContentsParams.content)).toBe(
        fixtures.ReadmeContent.replace('Old stuff...', 'New content!')
      )
    })

    it('uses a custom commit message', async () => {
      opts.message = 'Custom commit message!'
      await ReadmeBox.updateSection('New content!', opts)
      expect(updateFileContentsParams.message).toBe(opts.message)
    })

    it('does commit if `emptyCommits` is set to `true` and there are no changes', async () => {
      const result = await ReadmeBox.updateSection('Old stuff...', {
        ...opts,
        emptyCommits: true
      })

      expect(result).toBeDefined()
      expect(nock.isDone()).toBe(true)
    })

    it('does not create commit if `emptyCommits` is not set and there are no changes', async () => {
      const result = await ReadmeBox.updateSection('Old stuff...', opts)
      expect(result).toBeUndefined()
      expect(nock.isDone()).toBe(false)
    })
  })

  describe('#updateReadme', () => {
    it('updates the README', async () => {
      await box.updateReadme({ content: 'yep', sha: '123abc' })
      expect(decode(updateFileContentsParams.content)).toBe('yep')
    })

    it('uses the provided path', async () => {
      await box.updateReadme({
        path: 'readme.markdown',
        content: 'yep',
        sha: '123abc'
      })
      expect(updateFileContentsUri.endsWith('readme.markdown')).toBe(true)
    })
  })

  describe('#getSection', () => {
    it('returns the expected content', () => {
      const result = box.getSection('example', fixtures.ReadmeContent)
      expect(result).toBe('Old stuff...')
    })

    it('returns undefined if nothing was found', () => {
      const result = box.getSection('nope', fixtures.ReadmeContent)
      expect(result).toBeUndefined()
    })

    it('returns undefined if the section is empty', () => {
      const result = box.getSection(
        'example',
        '<!--START_SECTION:example-->\n<!--END_SECTION:example-->'
      )
      expect(result).toBeUndefined()
    })
  })

  describe('#replaceSection', () => {
    it("replaces the section's contents", () => {
      const result = box.replaceSection({
        newContents: 'New content!',
        oldContents: fixtures.ReadmeContent,
        section: 'example'
      })
      expect(result).toBe(
        fixtures.ReadmeContent.replace('Old stuff...', 'New content!')
      )
    })

    it('throws an error if the section was not found', () => {
      expect(() =>
        box.replaceSection({
          newContents: 'New content!',
          oldContents: 'Pizza',
          section: 'example'
        })
      ).toThrowError(
        'Contents do not contain start/end comments for section "example"'
      )
    })

    it('works when the comments are not separated by any content', () => {
      const result = box.replaceSection({
        newContents: 'New content!',
        oldContents: '<!--START_SECTION:example-->\n<!--END_SECTION:example-->',
        section: 'example'
      })
      expect(result).toBe(
        '<!--START_SECTION:example-->\nNew content!\n<!--END_SECTION:example-->'
      )
    })
  })
})
