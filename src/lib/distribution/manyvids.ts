import {
  mkdir,
  unlink,
  writeFile,
} from "fs/promises";

import os from "os";
import path from "path";

import {
  chromium,
  type Locator,
  type Page,
} from "playwright";

import {
  getR2ObjectDownloadUrl,
} from "@/src/lib/storage/r2";

const MANYVIDS_UPLOAD_URL =
  "https://www.manyvids.com/upload-video";

const MANYVIDS_RUNTIME_DIR =
  path.join(
    process.cwd(),
    ".runtime",
    "manyvids",
  );

type StageManyVidsVideoInput = {
  creatorId: string;
  objectKey: string;
  originalFileName: string;
  title?: string | null;
  description?: string | null;
  price: number;
  tags: string[];
  publishMode:
    | "NOW"
    | "SCHEDULED";
  scheduleDate:
    | string
    | null;
  scheduleTime:
    | string
    | null;
  thumbnailMode:
    | "AUTO"
    | "CUSTOM";
  thumbnail:
    | {
        name: string;
        mimeType: string;
        buffer: Buffer;
      }
    | null;
};

export type StageManyVidsVideoResult = {
  success: boolean;
  fileSelected: boolean;
  editPageOpened: boolean;
  fieldsFilled: boolean;
  currentUrl: string;
  fileName: string;
  externalVideoId: string | null;
  priceFilled: boolean;
  thumbnailApplied: boolean;
  tagsFilled: boolean;
  scheduleConfigured: boolean;
  saved: boolean;
};

function sanitizeCreatorId(
  creatorId: string,
) {
  return creatorId.replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
}

function sanitizeFileName(
  fileName: string,
) {
  const clean =
    fileName.replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

  return (
    clean ||
    "manyvids-upload.mp4"
  );
}

function titleFromFileName(
  fileName: string,
) {
  const withoutExtension =
    fileName.replace(
      /\.[^.]+$/,
      "",
    );

  const normalized =
    withoutExtension
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  return (
    normalized ||
    "New Video"
  ).slice(0, 180);
}

function getProfilePath(
  creatorId: string,
) {
  return path.join(
    MANYVIDS_RUNTIME_DIR,
    sanitizeCreatorId(
      creatorId,
    ),
  );
}

async function locatorIsVisible(
  locator: Locator,
) {
  try {
    return await locator
      .first()
      .isVisible();
  } catch {
    return false;
  }
}

function getExternalVideoId(
  currentUrl: string,
) {
  const match =
    currentUrl.match(
      /\/Edit-vid\/(\d+)/i,
    );

  return match?.[1] ?? null;
}

async function waitForEditUrl(
  page: Page,
  excludedVideoIds:
    Set<string> =
      new Set<string>(),
) {
  const timeoutMs =
    20 * 60 * 1000;

  const startedAt =
    Date.now();

  while (
    Date.now() -
      startedAt <
    timeoutMs
  ) {
    /*
     * First: if ManyVids itself navigated to a NEW
     * Edit-vid URL, trust that.
     */
    const currentId =
      getExternalVideoId(
        page.url(),
      );

    if (
      currentId &&
      !excludedVideoIds.has(
        currentId,
      )
    ) {
      console.log(
        "MANYVIDS_NEW_EDIT_URL_FROM_PAGE",
        {
          videoId:
            currentId,
          url:
            page.url(),
        },
      );

      return page.url();
    }

    /*
     * Second: inspect ALL Edit-vid links and only
     * accept an ID that was NOT present before the
     * upload started. The old implementation used
     * .first(), which could select a previous video
     * already sitting on the page.
     */
    const editLinks =
      page.locator(
        '[href*="/Edit-vid/"]',
      );

    const count =
      await editLinks.count();

    for (
      let index = 0;
      index < count;
      index++
    ) {
      try {
        const href =
          await editLinks
            .nth(index)
            .getAttribute(
              "href",
            );

        if (!href) {
          continue;
        }

        const absolute =
          new URL(
            href,
            "https://www.manyvids.com",
          ).toString();

        const videoId =
          getExternalVideoId(
            absolute,
          );

        if (
          !videoId ||
          excludedVideoIds.has(
            videoId,
          )
        ) {
          continue;
        }

        console.log(
          "MANYVIDS_NEW_EDIT_URL_FROM_LINK",
          {
            videoId,
            url:
              absolute,
          },
        );

        return absolute;
      } catch {
        // Continue with next link.
      }
    }

    /*
     * Last resort: click only edit controls whose
     * resulting URL is a NEW video ID.
     */
    const editButtons = [
      page.getByRole(
        "button",
        {
          name:
            /edit/i,
        },
      ),
      page.locator(
        'button[aria-label*="edit" i]',
      ),
      page.locator(
        'button[title*="edit" i]',
      ),
      page.locator(
        '[aria-label*="edit" i]',
      ),
      page.locator(
        '[title*="edit" i]',
      ),
    ];

    for (
      const candidate of
        editButtons
    ) {
      try {
        const buttonCount =
          await candidate.count();

        for (
          let index = 0;
          index < buttonCount;
          index++
        ) {
          const button =
            candidate.nth(
              index,
            );

          if (
            !(await locatorIsVisible(
              button,
            ))
          ) {
            continue;
          }

          const beforeUrl =
            page.url();

          await button.click();

          try {
            await page.waitForURL(
              /\/Edit-vid\/\d+/i,
              {
                timeout: 3000,
              },
            );
          } catch {
            // May update asynchronously.
          }

          const afterId =
            getExternalVideoId(
              page.url(),
            );

          if (
            afterId &&
            !excludedVideoIds.has(
              afterId,
            )
          ) {
            console.log(
              "MANYVIDS_NEW_EDIT_URL_FROM_BUTTON",
              {
                videoId:
                  afterId,
                url:
                  page.url(),
              },
            );

            return page.url();
          }

          if (
            page.url() !==
            beforeUrl
          ) {
            await page.goBack({
              waitUntil:
                "domcontentloaded",
            }).catch(
              () => {},
            );
          }
        }
      } catch {
        // Continue with next candidate.
      }
    }

    await page.waitForTimeout(
      1000,
    );
  }

  throw new Error(
    "MANYVIDS_NEW_EDIT_URL_NOT_FOUND",
  );
}

async function chooseOptionNearQuestion(
  page: Page,
  question: RegExp,
  option: RegExp,
) {
  const questionText =
    page.getByText(
      question,
      {
        exact: false,
      },
    ).first();

  try {
    await questionText.waitFor({
      state: "visible",
      timeout: 10_000,
    });
  } catch {
    return false;
  }

  /*
   * Strategy 1:
   * ManyVids may render this as a normal <select>.
   * We specifically choose the FIRST select after
   * the question text, avoiding unrelated selects.
   */
  try {
    const nearbySelect =
      questionText.locator(
        "xpath=following::select[1]",
      );

    if (
      (await nearbySelect.count()) >
      0
    ) {
      const options =
        await nearbySelect
          .locator("option")
          .allTextContents();

      const match =
        options.find(
          (value) =>
            option.test(
              value.trim(),
            ),
        );

      if (match) {
        await nearbySelect.selectOption({
          label: match,
        });

        return true;
      }
    }
  } catch {
    // Continue with custom-dropdown strategy.
  }

  /*
   * Strategy 2:
   * ManyVids may render a custom dropdown.
   * Find the first visible "Select" AFTER the
   * requested question, click it, then choose
   * the visible requested option.
   */
  try {
    const trigger =
      questionText.locator(
        "xpath=following::*[normalize-space()='Select'][1]",
      );

    if (
      (await trigger.count()) >
        0 &&
      (await locatorIsVisible(
        trigger,
      ))
    ) {
      await trigger.click();

      await page.waitForTimeout(
        300,
      );

      const byRole =
        page.getByRole(
          "option",
          {
            name: option,
          },
        );

      if (
        await locatorIsVisible(
          byRole,
        )
      ) {
        await byRole
          .first()
          .click();

        return true;
      }

      const visibleText =
        page.getByText(
          option,
          {
            exact: true,
          },
        );

      const count =
        await visibleText.count();

      for (
        let index =
          count - 1;
        index >= 0;
        index--
      ) {
        const candidate =
          visibleText.nth(
            index,
          );

        if (
          await locatorIsVisible(
            candidate,
          )
        ) {
          await candidate.click();

          return true;
        }
      }
    }
  } catch {
    // Continue with DOM-based fallback.
  }

  /*
   * Strategy 3:
   * Last-resort DOM fallback for custom ManyVids
   * controls. It searches forward from the question
   * for a clickable element containing "Select".
   */
  try {
    const clicked =
      await questionText.evaluate(
        (questionElement) => {
          let node:
            Element | null =
              questionElement;

          for (
            let i = 0;
            i < 80 &&
            node;
            i++
          ) {
            node =
              node.nextElementSibling ??
              node.parentElement
                ?.nextElementSibling ??
              null;

            if (!node) {
              break;
            }

            const text =
              node.textContent
                ?.trim();

            if (
              text === "Select"
            ) {
              (
                node as HTMLElement
              ).click();

              return true;
            }

            const selectChild =
              Array.from(
                node.querySelectorAll(
                  "*",
                ),
              ).find(
                (element) =>
                  element.textContent
                    ?.trim() ===
                  "Select",
              );

            if (
              selectChild
            ) {
              (
                selectChild as HTMLElement
              ).click();

              return true;
            }
          }

          return false;
        },
      );

    if (clicked) {
      await page.waitForTimeout(
        300,
      );

      const visibleText =
        page.getByText(
          option,
          {
            exact: true,
          },
        );

      const count =
        await visibleText.count();

      for (
        let index =
          count - 1;
        index >= 0;
        index--
      ) {
        const candidate =
          visibleText.nth(
            index,
          );

        if (
          await locatorIsVisible(
            candidate,
          )
        ) {
          await candidate.click();

          return true;
        }
      }
    }
  } catch {
    // Nothing else to try.
  }

  return false;
}

async function chooseNoCoPerformers(
  page: Page,
) {
  return chooseOptionNearQuestion(
    page,
    /Does This Vid Feature One Or More Co-Performers/i,
    /^No$/i,
  );
}

async function chooseNoAiGenerated(
  page: Page,
) {
  return chooseOptionNearQuestion(
    page,
    /Is this Vid fully AI-generated/i,
    /^No$/i,
  );
}

async function chooseNo3d(
  page: Page,
) {
  return chooseOptionNearQuestion(
    page,
    /Is this Vid fully 3D/i,
    /^No$/i,
  );
}

async function fillManyVidsPrice(
  page: Page,
  price: number,
) {
  const formatted =
    price.toFixed(2);

  const candidates = [
    page.locator(
      'input[name*="price" i]',
    ),
    page.locator(
      'input[id*="price" i]',
    ),
    page.locator(
      'input[placeholder*="price" i]',
    ),
  ];

  for (
    const candidate of
      candidates
  ) {
    try {
      if (
        (await candidate.count()) >
          0 &&
        (await locatorIsVisible(
          candidate.first(),
        ))
      ) {
        await candidate
          .first()
          .fill(
            formatted,
          );

        return true;
      }
    } catch {
      // Continue.
    }
  }

  const pricingHeading =
    page.getByText(
      /Set Your Price/i,
      {
        exact: false,
      },
    ).first();

  try {
    if (
      (await pricingHeading.count()) >
      0
    ) {
      const nearbyInput =
        pricingHeading.locator(
          "xpath=following::input[1]",
        );

      if (
        (await nearbyInput.count()) >
          0
      ) {
        await nearbyInput.fill(
          formatted,
        );

        return true;
      }
    }
  } catch {
    // Continue.
  }

  return false;
}

async function cropAndSaveManyVidsThumbnail(
  page: Page,
) {
  /*
   * ManyVids requires an ACTUAL mouse crop selection.
   * Merely uploading the image is not enough.
   *
   * Flow here:
   * 1) wait until the uploaded image/crop surface is visible
   * 2) drag the mouse across the image to create a crop box
   * 3) wait briefly for ManyVids/Jcrop to register it
   * 4) click the literal SAVE button in #editPic
   */
  const modal =
    page.locator(
      "#editPic",
    );

  await modal.waitFor({
    state: "visible",
    timeout: 10_000,
  });

  let cropSurface:
    | Locator
    | null =
      null;

  /*
   * Prefer the actual Jcrop tracker/holder when present.
   * If ManyVids has not exposed those classes yet, use
   * the large uploaded image itself and perform the drag
   * directly over it. This is still a real mouse action.
   */
  for (
    let attempt = 0;
    attempt < 60;
    attempt++
  ) {
    const preferred = [
      modal.locator(
        ".jcrop-tracker",
      ),
      modal.locator(
        ".jcrop-holder",
      ),
      modal.locator(
        ".cropper-crop-box",
      ),
      modal.locator(
        ".cropper-container",
      ),
      modal.locator(
        "canvas",
      ),
      modal.locator(
        "img",
      ),
    ];

    let best:
      | Locator
      | null =
        null;

    let bestArea =
      0;

    for (
      const candidates of
        preferred
    ) {
      const count =
        await candidates.count();

      for (
        let index = 0;
        index < count;
        index++
      ) {
        const current =
          candidates.nth(
            index,
          );

        if (
          !(await locatorIsVisible(
            current,
          ))
        ) {
          continue;
        }

        const box =
          await current.boundingBox();

        if (
          !box ||
          box.width < 180 ||
          box.height < 140
        ) {
          continue;
        }

        const area =
          box.width *
          box.height;

        if (
          area >
          bestArea
        ) {
          bestArea =
            area;
          best =
            current;
        }
      }
    }

    if (best) {
      cropSurface =
        best;
      break;
    }

    await page.waitForTimeout(
      200,
    );
  }

  if (!cropSurface) {
    console.log(
      "MANYVIDS_THUMBNAIL_MOUSE_CROP_SURFACE_NOT_FOUND",
    );

    return false;
  }

  const box =
    await cropSurface.boundingBox();

  if (!box) {
    return false;
  }

  /*
   * Real mouse crop:
   * start near the upper-left of the image and drag
   * diagonally to near the lower-right.
   */
  const startX =
    box.x +
    Math.max(
      20,
      box.width *
        0.12,
    );

  const startY =
    box.y +
    Math.max(
      20,
      box.height *
        0.12,
    );

  const endX =
    box.x +
    Math.min(
      box.width - 20,
      box.width *
        0.82,
    );

  const endY =
    box.y +
    Math.min(
      box.height - 20,
      box.height *
        0.82,
    );

  console.log(
    "MANYVIDS_THUMBNAIL_MOUSE_CROP_START",
    {
      width:
        Math.round(
          box.width,
        ),
      height:
        Math.round(
          box.height,
        ),
      startX:
        Math.round(
          startX,
        ),
      startY:
        Math.round(
          startY,
        ),
      endX:
        Math.round(
          endX,
        ),
      endY:
        Math.round(
          endY,
        ),
    },
  );

  await page.mouse.move(
    startX,
    startY,
  );

  await page.mouse.down();

  await page.waitForTimeout(
    180,
  );

  await page.mouse.move(
    endX,
    endY,
    {
      steps: 40,
    },
  );

  await page.waitForTimeout(
    120,
  );

  await page.mouse.up();

  await page.waitForTimeout(
    600,
  );

  console.log(
    "MANYVIDS_THUMBNAIL_MOUSE_CROP_DONE",
  );

  /*
   * Only the literal SAVE button is accepted.
   * Never use generic .btn-primary because BROWSE
   * is also a primary button.
   */
  const saveCandidates = [
    modal.getByRole(
      "button",
      {
        name:
          /^\s*save\s*$/i,
      },
    ),
    modal.locator(
      'button:has-text("SAVE")',
    ),
    modal.locator(
      'input[type="submit"][value="Save" i]',
    ),
    modal.getByText(
      /^\s*SAVE\s*$/i,
      {
        exact: true,
      },
    ),
  ];

  let saveButton:
    | Locator
    | null =
      null;

  for (
    const candidate of
      saveCandidates
  ) {
    const count =
      await candidate.count();

    for (
      let index = 0;
      index < count;
      index++
    ) {
      const current =
        candidate.nth(
          index,
        );

      if (
        await locatorIsVisible(
          current,
        )
      ) {
        saveButton =
          current;
        break;
      }
    }

    if (saveButton) {
      break;
    }
  }

  if (!saveButton) {
    console.log(
      "MANYVIDS_THUMBNAIL_SAVE_AFTER_MOUSE_CROP_NOT_FOUND",
    );

    return false;
  }

  await saveButton.click();

  await page.waitForTimeout(
    900,
  );

  const cropError =
    modal.getByText(
      /must make an image crop selection/i,
      {
        exact: false,
      },
    );

  if (
    await locatorIsVisible(
      cropError,
    )
  ) {
    console.log(
      "MANYVIDS_THUMBNAIL_MOUSE_CROP_REJECTED",
    );

    return false;
  }

  /*
   * Give ManyVids time to apply/persist the cropped image.
   */
  await page.waitForTimeout(
    1200,
  );

  console.log(
    "MANYVIDS_THUMBNAIL_CROP_SAVED_REAL",
  );

  return true;
}


async function normalizeManyVidsThumbnail(
  page: Page,
  thumbnail: {
    name: string;
    mimeType: string;
    buffer: Buffer;
  },
) {
  /*
   * ManyVids rejects thumbnails whose HEIGHT is below 720px.
   * When that happens, the site's old preview can remain visible,
   * which makes it look like the previous image was reused.
   *
   * Normalize the image in-browser before handing it to ManyVids:
   * - preserve aspect ratio
   * - upscale only when height < 720
   * - output PNG
   * - give every upload a unique filename so the site's legacy
   *   widget cannot confuse two selections with the same name/state
   */
  const sourceBase64 =
    thumbnail.buffer.toString(
      "base64",
    );

  const result =
    await page.evaluate(
      async ({
        sourceBase64,
        mimeType,
      }) => {
        const source =
          `data:${mimeType};base64,${sourceBase64}`;

        const image =
          new Image();

        await new Promise<void>(
          (
            resolve,
            reject,
          ) => {
            image.onload =
              () => resolve();

            image.onerror =
              () =>
                reject(
                  new Error(
                    "THUMBNAIL_IMAGE_LOAD_FAILED",
                  ),
                );

            image.src =
              source;
          },
        );

        const originalWidth =
          image.naturalWidth;

        const originalHeight =
          image.naturalHeight;

        const targetHeight =
          Math.max(
            720,
            originalHeight,
          );

        const scale =
          targetHeight /
          originalHeight;

        const targetWidth =
          Math.max(
            1,
            Math.round(
              originalWidth *
                scale,
            ),
          );

        const canvas =
          document.createElement(
            "canvas",
          );

        canvas.width =
          targetWidth;

        canvas.height =
          targetHeight;

        const context =
          canvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "THUMBNAIL_CANVAS_CONTEXT_FAILED",
          );
        }

        context.drawImage(
          image,
          0,
          0,
          targetWidth,
          targetHeight,
        );

        const dataUrl =
          canvas.toDataURL(
            "image/png",
            0.95,
          );

        return {
          dataUrl,
          originalWidth,
          originalHeight,
          targetWidth,
          targetHeight,
        };
      },
      {
        sourceBase64,
        mimeType:
          thumbnail.mimeType ||
          "image/png",
      },
    );

  const base64 =
    result.dataUrl.replace(
      /^data:image\/png;base64,/,
      "",
    );

  const uniqueName =
    `manyvids-thumb-${Date.now()}.png`;

  console.log(
    "MANYVIDS_THUMBNAIL_NORMALIZED",
    {
      originalWidth:
        result.originalWidth,
      originalHeight:
        result.originalHeight,
      targetWidth:
        result.targetWidth,
      targetHeight:
        result.targetHeight,
      uniqueName,
    },
  );

  return {
    name:
      uniqueName,
    mimeType:
      "image/png",
    buffer:
      Buffer.from(
        base64,
        "base64",
      ),
  };
}

async function applyManyVidsThumbnail(
  page: Page,
  thumbnail:
    | {
        name: string;
        mimeType: string;
        buffer: Buffer;
      }
    | null,
) {
  if (!thumbnail) {
    return false;
  }

  const normalizedThumbnail =
    await normalizeManyVidsThumbnail(
      page,
      thumbnail,
    );

  const thumbnailTempDirectory =
    path.join(
      os.tmpdir(),
      "creator-platform-manyvids-thumbnails",
    );

  await mkdir(
    thumbnailTempDirectory,
    {
      recursive: true,
    },
  );

  const thumbnailTempPath =
    path.join(
      thumbnailTempDirectory,
      normalizedThumbnail.name,
    );

  /*
   * Use a REAL temporary PNG file on disk.
   * The ManyVids thumbnail widget is old/legacy and
   * intermittently showed a broken "Create Thumbnail"
   * image when the file came from Playwright's in-memory
   * buffer object.
   */
  await writeFile(
    thumbnailTempPath,
    normalizedThumbnail.buffer,
  );

  try {
    const editThumbnail =
      page.getByText(
        /Edit Thumbnail/i,
        {
          exact: false,
        },
      ).first();

    await editThumbnail.scrollIntoViewIfNeeded();
    await editThumbnail.click();

    await page.waitForTimeout(
      250,
    );

    const thumbnailDropdown =
      editThumbnail.locator(
        "xpath=ancestor::div[contains(@class,'dropdown')][1]",
      );

    const uploadItem =
      thumbnailDropdown
        .getByText(
          /^\s*Upload\s*$/i,
          {
            exact: true,
          },
        )
        .last();

    await uploadItem.click();

    const uploadPicTitle =
      page.getByText(
        /Upload Pic/i,
        {
          exact: false,
        },
      ).last();

    await uploadPicTitle.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    const uploader =
      page.locator(
        "#fileUploader",
      );

    await uploader.waitFor({
      state: "attached",
      timeout: 10_000,
    });

    /*
     * Clear stale selection first, then load the
     * physical PNG. setInputFiles() already fires the
     * browser input/change events, so do NOT fire them
     * a second time through native+jQuery handlers.
     */
    await uploader.setInputFiles([]);

    await page.waitForTimeout(
      150,
    );

    await uploader.setInputFiles(
      thumbnailTempPath,
    );

    console.log(
      "MANYVIDS_THUMBNAIL_REAL_FILE_HANDLED",
      {
        original:
          thumbnail.name,
        uploaded:
          normalizedThumbnail.name,
        path:
          thumbnailTempPath,
      },
    );

    /*
     * The crop must not start while the preview image is
     * broken. Wait until an image inside #editPic has real
     * pixels (naturalWidth/naturalHeight > 0).
     */
    const modal =
      page.locator(
        "#editPic",
      );

    await modal.waitFor({
      state: "visible",
      timeout: 10_000,
    });

    let imageReady =
      false;

    for (
      let attempt = 0;
      attempt < 50;
      attempt++
    ) {
      imageReady =
        await modal
          .locator(
            "img",
          )
          .evaluateAll(
            (
              images:
                HTMLImageElement[],
            ) =>
              images.some(
                (image) =>
                  image.complete &&
                  image.naturalWidth >
                    0 &&
                  image.naturalHeight >
                    0,
              ),
          )
          .catch(
            () => false,
          );

      if (imageReady) {
        break;
      }

      await page.waitForTimeout(
        200,
      );
    }

    console.log(
      "MANYVIDS_THUMBNAIL_PREVIEW_IMAGE_READY",
      imageReady,
    );

    if (!imageReady) {
      return false;
    }

    /*
     * From here on, use the SAME mouse-crop function
     * that already worked in the successful Schedule test.
     */
    return cropAndSaveManyVidsThumbnail(
      page,
    );
  } finally {
    await unlink(
      thumbnailTempPath,
    ).catch(
      () => {},
    );
  }
}

async function readManyVidsTagCount(
  page: Page,
) {
  const counter =
    page.locator(
      ".js-custom-tag-count",
    ).first();

  try {
    const value =
      (
        await counter.textContent()
      )?.trim() ??
      "0";

    const parsed =
      Number(
        value,
      );

    return Number.isFinite(
      parsed,
    )
      ? parsed
      : 0;
  } catch {
    return 0;
  }
}

async function fillManyVidsTags(
  page: Page,
  tags: string[],
) {
  const cleanTags =
    Array.from(
      new Set(
        (
          Array.isArray(tags)
            ? tags
            : []
        )
          .map(
            (tag) =>
              String(tag)
                .replace(
                  /^#+/,
                  "",
                )
                .trim(),
          )
          .filter(Boolean),
      ),
    ).slice(
      0,
      10,
    );

  if (
    cleanTags.length <
    3
  ) {
    return false;
  }

  const input =
    page.locator(
      "#input-new-custom-tag-filter",
    );

  const dropdown =
    page.locator(
      "#dropdown-items-custom-tags",
    );

  await input.waitFor({
    state: "visible",
    timeout: 10_000,
  });

  /*
   * After the thumbnail modal closes, ManyVids'
   * legacy tag widget can need a moment to rebind.
   * Do not change any publish/schedule logic here.
   */
  await page.waitForTimeout(
    800,
  );

  let currentCount =
    await readManyVidsTagCount(
      page,
    );

  const selectedTexts =
    new Set<string>();

  const typeTag = async (
    tag: string,
  ) => {
    await input.click({
      force: true,
    });

    await input.fill("");

    /*
     * Real keyboard typing is more reliable with the
     * ManyVids autocomplete than locator.fill(), which
     * can leave the dropdown empty on Publish Now.
     */
    await input.pressSequentially(
      tag,
      {
        delay: 70,
      },
    );

    await input.evaluate(
      (
        element:
          HTMLInputElement,
      ) => {
        element.dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true,
            },
          ),
        );

        element.dispatchEvent(
          new KeyboardEvent(
            "keyup",
            {
              bubbles: true,
              key: "a",
            },
          ),
        );

        element.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true,
            },
          ),
        );
      },
    );

    await page.waitForTimeout(
      900,
    );
  };

  for (
    const tag of
      cleanTags
  ) {
    if (
      currentCount >= 10
    ) {
      break;
    }

    const before =
      currentCount;

    let clickedExisting =
      false;

    /*
     * Give each requested tag up to three attempts.
     * The widget occasionally returns an empty dropdown
     * immediately after the thumbnail crop closes.
     */
    for (
      let attempt = 0;
      attempt < 3 &&
      currentCount <= before;
      attempt++
    ) {
      await typeTag(
        tag,
      );

      const items =
        dropdown.locator(
          "li",
        );

      const itemCount =
        await items.count();

      /*
       * 1) Prefer an exact/near-exact ManyVids result.
       */
      for (
        let index = 0;
        index < itemCount;
        index++
      ) {
        const item =
          items.nth(
            index,
          );

        if (
          !(await locatorIsVisible(
            item,
          ))
        ) {
          continue;
        }

        const itemText =
          (
            await item.textContent()
          )
            ?.replace(
              /\s+/g,
              " ",
            )
            .trim() ??
          "";

        if (
          !itemText ||
          /add\s+new\s+tag/i.test(
            itemText,
          ) ||
          selectedTexts.has(
            itemText.toLowerCase(),
          )
        ) {
          continue;
        }

        if (
          itemText
            .toLowerCase()
            .includes(
              tag.toLowerCase(),
            ) ||
          tag
            .toLowerCase()
            .includes(
              itemText.toLowerCase(),
            )
        ) {
          await item.click();

          selectedTexts.add(
            itemText.toLowerCase(),
          );

          clickedExisting =
            true;

          await page.waitForTimeout(
            400,
          );

          break;
        }
      }

      currentCount =
        await readManyVidsTagCount(
          page,
        );

      /*
       * 2) If no existing result was accepted, click
       * the visible "Add New Tag" action if ManyVids
       * offers it.
       */
      if (
        currentCount <= before
      ) {
        const addNew =
          page
            .getByText(
              /add\s+new\s+tag/i,
              {
                exact: false,
              },
            )
            .last();

        if (
          await locatorIsVisible(
            addNew,
          )
        ) {
          await addNew.click();

          await page.waitForTimeout(
            500,
          );

          const confirmCandidates = [
            page.getByRole(
              "button",
              {
                name:
                  /^(add|confirm|save)$/i,
              },
            ),
            page.getByText(
              /^(add|confirm|save)$/i,
              {
                exact: true,
              },
            ),
          ];

          for (
            const candidate of
              confirmCandidates
          ) {
            const count =
              await candidate.count();

            let confirmed =
              false;

            for (
              let index = count - 1;
              index >= 0;
              index--
            ) {
              const current =
                candidate.nth(
                  index,
                );

              if (
                await locatorIsVisible(
                  current,
                )
              ) {
                await current.click();

                await page.waitForTimeout(
                  350,
                );

                confirmed =
                  true;
                break;
              }
            }

            if (confirmed) {
              break;
            }
          }
        }
      }

      currentCount =
        await readManyVidsTagCount(
          page,
        );

      /*
       * 3) If the requested term still did not enter,
       * select the first unused visible ManyVids
       * suggestion. This is the same fallback that
       * already worked in the scheduled test.
       */
      if (
        currentCount <= before
      ) {
        const refreshedItems =
          dropdown.locator(
            "li",
          );

        const refreshedCount =
          await refreshedItems.count();

        for (
          let index = 0;
          index < refreshedCount;
          index++
        ) {
          const item =
            refreshedItems.nth(
              index,
            );

          if (
            !(await locatorIsVisible(
              item,
            ))
          ) {
            continue;
          }

          const itemText =
            (
              await item.textContent()
            )
              ?.replace(
                /\s+/g,
                " ",
              )
              .trim() ??
            "";

          if (
            !itemText ||
            /add\s+new\s+tag/i.test(
              itemText,
            ) ||
            selectedTexts.has(
              itemText.toLowerCase(),
            )
          ) {
            continue;
          }

          await item.click();

          selectedTexts.add(
            itemText.toLowerCase(),
          );

          await page.waitForTimeout(
            400,
          );

          break;
        }
      }

      currentCount =
        await readManyVidsTagCount(
          page,
        );

      if (
        currentCount <= before
      ) {
        /*
         * Re-focus/re-arm the legacy widget before
         * another attempt.
         */
        await input.press(
          "Escape",
        ).catch(
          () => {},
        );

        await page.waitForTimeout(
          350,
        );
      }
    }

    console.log(
      "MANYVIDS_TAG_RESULT",
      {
        requested:
          tag,
        before,
        after:
          currentCount,
        clickedExisting,
        dropdownHtml:
          (
            await dropdown.innerHTML()
          ).slice(
            0,
            1600,
          ),
      },
    );
  }

  /*
   * Final recovery pass until the ManyVids counter
   * reaches the required minimum of 3.
   */
  if (
    currentCount < 3
  ) {
    for (
      const tag of
        cleanTags
    ) {
      if (
        currentCount >= 3
      ) {
        break;
      }

      const before =
        currentCount;

      await typeTag(
        tag,
      );

      const items =
        dropdown.locator(
          "li",
        );

      const count =
        await items.count();

      for (
        let index = 0;
        index < count;
        index++
      ) {
        const item =
          items.nth(
            index,
          );

        if (
          !(await locatorIsVisible(
            item,
          ))
        ) {
          continue;
        }

        const itemText =
          (
            await item.textContent()
          )
            ?.replace(
              /\s+/g,
              " ",
            )
            .trim() ??
          "";

        if (
          !itemText ||
          /add\s+new\s+tag/i.test(
            itemText,
          ) ||
          selectedTexts.has(
            itemText.toLowerCase(),
          )
        ) {
          continue;
        }

        await item.click();

        selectedTexts.add(
          itemText.toLowerCase(),
        );

        await page.waitForTimeout(
          400,
        );

        currentCount =
          await readManyVidsTagCount(
            page,
          );

        if (
          currentCount > before
        ) {
          break;
        }
      }
    }
  }

  console.log(
    "MANYVIDS_TAG_FINAL_COUNT",
    currentCount,
  );

  return currentCount >= 3;
}

function toManyVidsTimeLabel(
  value: string,
) {
  const [
    hourText,
    minuteText,
  ] =
    value.split(":");

  const hour =
    Number(
      hourText,
    );

  const minute =
    minuteText ===
      "30"
      ? "30"
      : "00";

  const period =
    hour >= 12
      ? "PM"
      : "AM";

  const hour12 =
    hour % 12 || 12;

  return `${String(
    hour12,
  ).padStart(
    2,
    "0",
  )}:${minute} ${period}`;
}

async function configureManyVidsSchedule(
  page: Page,
  publishMode:
    | "NOW"
    | "SCHEDULED",
  scheduleDate:
    | string
    | null,
  scheduleTime:
    | string
    | null,
) {
  const launchNow =
    page.locator(
      "#launchNow",
    );

  const launchCustom =
    page.locator(
      "#launchCustom",
    );

  if (
    publishMode ===
    "NOW"
  ) {
    if (
      await launchNow.count()
    ) {
      await launchNow.check({
        force: true,
      });
    }

    return true;
  }

  if (
    !scheduleDate ||
    !scheduleTime
  ) {
    return false;
  }

  /*
   * Exact controls from the real ManyVids DOM:
   * #launchCustom
   * #dp1
   * #available_time
   */
  await launchCustom.waitFor({
    state: "attached",
    timeout: 10_000,
  });

  /*
   * ManyVids hides the native radio and styles the
   * associated <label>. Playwright .check() still
   * refuses because the input itself is not visible.
   * Click the visible label first.
   */
  const launchCustomLabel =
    page.locator(
      'label[for="launchCustom"]',
    );

  if (
    await locatorIsVisible(
      launchCustomLabel,
    )
  ) {
    await launchCustomLabel.click();
  } else {
    /*
     * Fallback: set the native radio directly and
     * emit the same events the page listens for.
     */
    await page.evaluate(
      () => {
        const custom =
          document.querySelector<HTMLInputElement>(
            "#launchCustom",
          );

        const now =
          document.querySelector<HTMLInputElement>(
            "#launchNow",
          );

        if (!custom) {
          return;
        }

        if (now) {
          now.checked =
            false;

          now.dispatchEvent(
            new Event(
              "change",
              {
                bubbles: true,
              },
            ),
          );
        }

        custom.checked =
          true;

        custom.dispatchEvent(
          new MouseEvent(
            "click",
            {
              bubbles: true,
            },
          ),
        );

        custom.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true,
            },
          ),
        );
      },
    );
  }

  await page.waitForTimeout(
    250,
  );

  let launchChecked =
    await launchCustom.isChecked();

  /*
   * Some ManyVids layouts toggle visual state from
   * the label but do not immediately synchronize the
   * hidden input. Normalize the radio state if needed.
   */
  if (!launchChecked) {
    await launchCustom.evaluate(
      (
        element:
          HTMLInputElement,
      ) => {
        element.checked =
          true;

        element.dispatchEvent(
          new Event(
            "input",
            {
              bubbles: true,
            },
          ),
        );

        element.dispatchEvent(
          new Event(
            "change",
            {
              bubbles: true,
            },
          ),
        );
      },
    );

    launchChecked =
      await launchCustom.isChecked();
  }

  if (!launchChecked) {
    console.log(
      "MANYVIDS_SCHEDULE_RADIO_FAILED",
    );

    return false;
  }

  const dateInput =
    page.locator(
      "#dp1",
    );

  await dateInput.waitFor({
    state: "attached",
    timeout: 10_000,
  });

  /*
   * #dp1 is readonly, so set it through the DOM
   * and emit the events ManyVids listens for.
   */
  await dateInput.evaluate(
    (
      element:
        HTMLInputElement,
      value,
    ) => {
      element.value =
        String(value);

      element.setAttribute(
        "value",
        String(value),
      );

      element.setAttribute(
        "data-date",
        String(value),
      );

      element.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true,
          },
        ),
      );

      element.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true,
          },
        ),
      );
    },
    scheduleDate,
  );

  const dateValue =
    await dateInput.inputValue();

  const [
    hourRaw,
    minuteRaw,
  ] =
    scheduleTime.split(":");

  const requestedHour =
    Number(hourRaw);

  const requestedMinute =
    Number(minuteRaw);

  if (
    !Number.isFinite(
      requestedHour,
    ) ||
    !Number.isFinite(
      requestedMinute,
    )
  ) {
    return false;
  }

  const requestedTotal =
    requestedHour *
      60 +
    requestedMinute;

  const timeSelect =
    page.locator(
      "#available_time",
    );

  await timeSelect.waitFor({
    state: "attached",
    timeout: 10_000,
  });

  const options =
    await timeSelect
      .locator("option")
      .evaluateAll(
        (nodes) =>
          nodes.map(
            (node) => ({
              value:
                (
                  node as HTMLOptionElement
                ).value,
              label:
                (
                  node as HTMLOptionElement
                ).textContent
                  ?.replace(
                    /\s+/g,
                    " ",
                  )
                  .trim() ??
                "",
            }),
          ),
      );

  const validOptions =
    options
      .map(
        (option) => {
          const match =
            option.value.match(
              /^(\d{1,2}):(\d{2})(?::\d{2})?$/,
            );

          if (!match) {
            return null;
          }

          const hour =
            Number(
              match[1],
            );

          const minute =
            Number(
              match[2],
            );

          if (
            !Number.isFinite(
              hour,
            ) ||
            !Number.isFinite(
              minute,
            )
          ) {
            return null;
          }

          return {
            ...option,
            total:
              hour *
                60 +
              minute,
          };
        },
      )
      .filter(
        (
          value,
        ): value is {
          value: string;
          label: string;
          total: number;
        } =>
          value !==
          null,
      );

  if (
    validOptions.length ===
    0
  ) {
    return false;
  }

  /*
   * ManyVids exposes 30-minute slots.
   * Never schedule earlier than the requested time.
   */
  const orderedFuture =
    validOptions
      .filter(
        (option) =>
          option.total >=
          requestedTotal,
      )
      .sort(
        (a, b) =>
          a.total -
          b.total,
      );

  const selectedOption =
    orderedFuture[0] ??
    validOptions
      .slice()
      .sort(
        (a, b) =>
          Math.abs(
            a.total -
              requestedTotal,
          ) -
          Math.abs(
            b.total -
              requestedTotal,
          ),
      )[0];

  /*
   * ManyVids wraps #available_time with a visible
   * "nice-select" control. Updating only the hidden
   * <select> can leave the UI at the old 10:00 AM
   * value and may not update the site's own state.
   *
   * So first interact with the VISIBLE dropdown.
   */
  const niceSelect =
    timeSelect.locator(
      "xpath=following-sibling::div[contains(@class,'nice-select')][1]",
    );

  let visibleTimeApplied =
    false;

  if (
    await locatorIsVisible(
      niceSelect,
    )
  ) {
    await niceSelect.click();

    await page.waitForTimeout(
      150,
    );

    const visibleOption =
      niceSelect.locator(
        `li.option[data-value="${selectedOption.value}"]`,
      );

    if (
      await locatorIsVisible(
        visibleOption,
      )
    ) {
      await visibleOption.click();

      visibleTimeApplied =
        true;

      await page.waitForTimeout(
        250,
      );
    }
  }

  /*
   * Fallback/normalization: keep the native select
   * synchronized with the visible control.
   */
  await timeSelect.selectOption(
    selectedOption.value,
  );

  await timeSelect.evaluate(
    (
      element:
        HTMLSelectElement,
    ) => {
      element.dispatchEvent(
        new Event(
          "input",
          {
            bubbles: true,
          },
        ),
      );

      element.dispatchEvent(
        new Event(
          "change",
          {
            bubbles: true,
          },
        ),
      );
    },
  );

  const selectedTime =
    await timeSelect.inputValue();

  let visibleLabel =
    "";

  if (
    await niceSelect.count()
  ) {
    visibleLabel =
      (
        await niceSelect
          .locator(
            "span.current",
          )
          .textContent()
      )
        ?.replace(
          /\s+/g,
          " ",
        )
        .trim() ??
      "";
  }

  const configured =
    launchChecked &&
    dateValue ===
      scheduleDate &&
    selectedTime ===
      selectedOption.value &&
    visibleLabel
      .toLowerCase() ===
      selectedOption.label
        .toLowerCase();

  console.log(
    "MANYVIDS_SCHEDULE_EXACT_RESULT",
    {
      requestedDate:
        scheduleDate,
      requestedTime:
        scheduleTime,
      appliedDate:
        dateValue,
      appliedTime:
        selectedTime,
      expectedLabel:
        selectedOption.label,
      visibleLabel,
      visibleTimeApplied,
      launchCustom:
        launchChecked,
      configured,
    },
  );

  return configured;
}

async function ensureManyVidsTeaser(
  page: Page,
) {
  const container =
    page.locator(
      ".js-teaser-container",
    );

  const selected =
    container.locator(
      ".js-teaser-selected",
    );

  const viewCurrent =
    container.locator(
      ".js-generate-video-teaser-html",
    );

  const hasTeaser =
    async () => {
      const value =
        (
          await selected.getAttribute(
            "value",
          )
        )?.trim() ??
        "";

      if (value) {
        return true;
      }

      try {
        return await locatorIsVisible(
          viewCurrent,
        );
      } catch {
        return false;
      }
    };

  if (
    await hasTeaser()
  ) {
    return true;
  }

  /*
   * Exact ManyVids teaser editor captured from DOM.
   * Open "Create from vid".
   */
  const menu =
    container.locator(
      ".dropdown-toggle",
    );

  await menu.click();

  await page.waitForTimeout(
    250,
  );

  const createFromVid =
    container.locator(
      ".js-edit-preview-vid",
    );

  /*
   * The menu item itself can be hidden after the
   * create-from-video panel opens, so click it only
   * when it is actually visible.
   */
  if (
    await locatorIsVisible(
      createFromVid,
    )
  ) {
    await createFromVid.click();

    await page.waitForTimeout(
      500,
    );
  }

  /*
   * Exact controls from the ManyVids DOM:
   * .js-preview-minutes
   * .js-preview-seconds
   * .js-create-preview-vid
   */
  const createWrapper =
    page.locator(
      ".js-create-preview-wrapper",
    );

  await createWrapper.waitFor({
    state: "visible",
    timeout: 10_000,
  });

  const minutes =
    createWrapper.locator(
      ".js-preview-minutes",
    );

  const seconds =
    createWrapper.locator(
      ".js-preview-seconds",
    );

  const createButton =
    createWrapper.locator(
      ".js-create-preview-vid",
    );

  await minutes.fill(
    "0",
  );

  /*
   * Start the teaser a few seconds into the video
   * when possible. This avoids edge-case rejection
   * at exactly 00:00 while still creating it from
   * the beginning.
   */
  const videoLengthRaw =
    await createWrapper
      .locator(
        ".js-video-length",
      )
      .getAttribute(
        "value",
      );

  const videoLength =
    Number(
      videoLengthRaw ??
      "0",
    );

  await seconds.fill(
    videoLength >= 10
      ? "5"
      : "0",
  );

  await createButton.click();

  console.log(
    "MANYVIDS_TEASER_CREATE_CLICKED",
    {
      startMinute:
        0,
      startSecond:
        videoLength >= 10
          ? 5
          : 0,
      videoLength,
    },
  );

  /*
   * Teaser generation is asynchronous. Wait for
   * ManyVids to expose either the selected hidden
   * state or the "View current teaser" action.
   */
  for (
    let attempt = 0;
    attempt < 120;
    attempt++
  ) {
    if (
      await hasTeaser()
    ) {
      console.log(
        "MANYVIDS_TEASER_READY",
      );

      /*
       * ManyVids may automatically open the "My Teaser"
       * preview modal after generation. Close it before
       * returning so the main Save can continue.
       */
      await page.waitForTimeout(
        500,
      );

      const teaserModalClosed =
        await closeManyVidsTeaserModal(
          page,
        );

      if (!teaserModalClosed) {
        throw new Error(
          "MANYVIDS_TEASER_MODAL_NOT_CLOSED",
        );
      }

      return true;
    }

    /*
     * If the create wrapper disappears, ManyVids
     * may already have accepted the request. Give
     * the page time to finish generation.
     */
    await page.waitForTimeout(
      1000,
    );
  }

  /*
   * Surface any ManyVids validation message before
   * declaring failure.
   */
  try {
    const alerts =
      page.locator(
        '#gritter-notice-wrapper [role="alert"], #gritter-notice-wrapper .gritter-item-wrapper, [role="alert"]',
      );

    const count =
      await alerts.count();

    const messages:
      string[] = [];

    for (
      let index = 0;
      index < count;
      index++
    ) {
      const alert =
        alerts.nth(
          index,
        );

      if (
        !(await locatorIsVisible(
          alert,
        ))
      ) {
        continue;
      }

      const value =
        (
          await alert.textContent()
        )
          ?.replace(
            /\s+/g,
            " ",
          )
          .trim();

      if (value) {
        messages.push(
          value,
        );
      }
    }

    console.log(
      "MANYVIDS_TEASER_TIMEOUT",
      messages,
    );
  } catch {
    // Diagnostic only.
  }

  return false;
}

async function closeManyVidsTeaserModal(
  page: Page,
) {
  /*
   * After ManyVids finishes creating the teaser it can
   * open a "My Teaser" preview modal. That modal must be
   * closed before the main #saveVideo button can be used.
   */
  const title =
    page.getByText(
      /^\s*My Teaser\s*$/i,
      {
        exact: true,
      },
    );

  const count =
    await title.count();

  for (
    let index = count - 1;
    index >= 0;
    index--
  ) {
    const currentTitle =
      title.nth(
        index,
      );

    if (
      !(await locatorIsVisible(
        currentTitle,
      ))
    ) {
      continue;
    }

    let modal =
      currentTitle.locator(
        "xpath=ancestor::*[contains(concat(' ',normalize-space(@class),' '),' modal ')][1]",
      );

    if (
      !(await modal.count())
    ) {
      continue;
    }

    console.log(
      "MANYVIDS_TEASER_MODAL_VISIBLE",
    );

    const closeCandidates = [
      modal.locator(
        '[data-dismiss="modal"]',
      ),
      modal.locator(
        '[data-bs-dismiss="modal"]',
      ),
      modal.locator(
        ".close",
      ),
      modal.getByRole(
        "button",
        {
          name:
            /close/i,
        },
      ),
      modal.locator(
        'button[aria-label="Close"]',
      ),
    ];

    for (
      const candidate of
        closeCandidates
    ) {
      const candidateCount =
        await candidate.count();

      for (
        let c =
          candidateCount - 1;
        c >= 0;
        c--
      ) {
        const current =
          candidate.nth(
            c,
          );

        if (
          !(await locatorIsVisible(
            current,
          ))
        ) {
          continue;
        }

        try {
          await current.click({
            force: true,
          });

          await modal.waitFor({
            state: "hidden",
            timeout: 3000,
          });

          console.log(
            "MANYVIDS_TEASER_MODAL_CLOSED",
          );

          return true;
        } catch {
          // Try another close control.
        }
      }
    }

    /*
     * Fallback for the X icon when it has no useful
     * accessible label/class. Click the visible element
     * in the modal header nearest the top-right corner.
     */
    try {
      const modalBox =
        await modal.boundingBox();

      if (modalBox) {
        const candidates =
          modal.locator(
            "button, a, span, div",
          );

        const candidateCount =
          await candidates.count();

        let best:
          | {
              locator: Locator;
              score: number;
            }
          | null =
            null;

        for (
          let c = 0;
          c < candidateCount;
          c++
        ) {
          const current =
            candidates.nth(
              c,
            );

          if (
            !(await locatorIsVisible(
              current,
            ))
          ) {
            continue;
          }

          const box =
            await current.boundingBox();

          if (
            !box ||
            box.width > 80 ||
            box.height > 80
          ) {
            continue;
          }

          const centerX =
            box.x +
            box.width / 2;

          const centerY =
            box.y +
            box.height / 2;

          const rightDistance =
            Math.abs(
              modalBox.x +
              modalBox.width -
              centerX,
            );

          const topDistance =
            Math.abs(
              centerY -
              modalBox.y,
            );

          const score =
            rightDistance +
            topDistance;

          if (
            !best ||
            score <
              best.score
          ) {
            best = {
              locator:
                current,
              score,
            };
          }
        }

        if (best) {
          await best.locator.click({
            force: true,
          });

          await modal.waitFor({
            state: "hidden",
            timeout: 3000,
          });

          console.log(
            "MANYVIDS_TEASER_MODAL_CLOSED_BY_TOP_RIGHT",
          );

          return true;
        }
      }
    } catch {
      // Fall through to Bootstrap API.
    }

    /*
     * Final fallback: use ManyVids' own Bootstrap/jQuery
     * modal API.
     */
    try {
      const hidden =
        await modal.evaluate(
          (
            element:
              HTMLElement,
          ) => {
            const win =
              window as unknown as {
                jQuery?: any;
                $?: any;
              };

            const jq =
              win.jQuery ??
              win.$;

            if (
              !jq
            ) {
              return false;
            }

            const wrapped =
              jq(
                element,
              );

            if (
              wrapped &&
              typeof wrapped.modal ===
                "function"
            ) {
              wrapped.modal(
                "hide",
              );

              return true;
            }

            return false;
          },
        );

      if (hidden) {
        await modal.waitFor({
          state: "hidden",
          timeout: 3000,
        });

        console.log(
          "MANYVIDS_TEASER_MODAL_CLOSED_BY_BOOTSTRAP",
        );

        return true;
      }
    } catch {
      // No-op.
    }

    return false;
  }

  return true;
}

async function closeManyVidsGenericPopup(
  page: Page,
) {
  const popup =
    page.locator(
      "#genericPopup",
    );

  try {
    if (
      !(await locatorIsVisible(
        popup,
      ))
    ) {
      return true;
    }
  } catch {
    return true;
  }

  console.log(
    "MANYVIDS_GENERIC_POPUP_VISIBLE",
  );

  const closeCandidates = [
    popup.locator(
      '[data-dismiss="modal"]',
    ),
    popup.locator(
      ".close",
    ),
    popup.getByRole(
      "button",
      {
        name:
          /close|done|cancel|ok/i,
      },
    ),
    popup.getByText(
      /close|done|cancel|ok/i,
      {
        exact: true,
      },
    ),
  ];

  for (
    const candidate of
      closeCandidates
  ) {
    try {
      const count =
        await candidate.count();

      for (
        let index =
          count - 1;
        index >= 0;
        index--
      ) {
        const current =
          candidate.nth(
            index,
          );

        if (
          !(await locatorIsVisible(
            current,
          ))
        ) {
          continue;
        }

        await current.click({
          force: true,
        });

        await page.waitForTimeout(
          500,
        );

        if (
          !(await locatorIsVisible(
            popup,
          ))
        ) {
          console.log(
            "MANYVIDS_GENERIC_POPUP_CLOSED_BY_CONTROL",
          );

          return true;
        }
      }
    } catch {
      // Try next close control.
    }
  }

  /*
   * ManyVids uses Bootstrap-style modals. If the
   * popup has no visible close control, use the
   * site's own jQuery/Bootstrap modal API instead
   * of deleting DOM nodes manually.
   */
  try {
    const hiddenByApi =
      await page.evaluate(
        () => {
          const win =
            window as unknown as {
              jQuery?: any;
              $?: any;
            };

          const jq =
            win.jQuery ??
            win.$;

          if (!jq) {
            return false;
          }

          const modal =
            jq(
              "#genericPopup",
            );

          if (
            modal &&
            typeof modal.modal ===
              "function"
          ) {
            modal.modal(
              "hide",
            );

            return true;
          }

          return false;
        },
      );

    if (hiddenByApi) {
      await page.waitForTimeout(
        600,
      );

      if (
        !(await locatorIsVisible(
          popup,
        ))
      ) {
        console.log(
          "MANYVIDS_GENERIC_POPUP_CLOSED_BY_BOOTSTRAP",
        );

        return true;
      }
    }
  } catch (
    error
  ) {
    console.log(
      "MANYVIDS_GENERIC_POPUP_CLOSE_API_ERROR",
      error instanceof Error
        ? error.message
        : String(
            error,
          ),
    );
  }

  return !(
    await locatorIsVisible(
      popup,
    )
  );
}

async function saveManyVidsEditPage(
  page: Page,
) {
  const popupClosed =
    await closeManyVidsGenericPopup(
      page,
    );

  if (!popupClosed) {
    throw new Error(
      "MANYVIDS_GENERIC_POPUP_NOT_CLOSED",
    );
  }

  /*
   * Exact ManyVids Save button captured:
   * #saveVideo
   */
  const saveButton =
    page.locator(
      "#saveVideo",
    );

  await saveButton.waitFor({
    state: "visible",
    timeout: 10_000,
  });

  await saveButton.scrollIntoViewIfNeeded();

  try {
    await saveButton.click({
      timeout: 5000,
    });
  } catch {
    await saveButton.click({
      force: true,
      timeout: 5000,
    });
  }

  console.log(
    "MANYVIDS_MAIN_SAVE_CLICKED",
  );

  await page.waitForTimeout(
    1800,
  );

  const visibleErrors =
    page.locator(
      '.error:visible, .alert:visible, [role="alert"]:visible',
    );

  const count =
    await visibleErrors.count();

  if (
    count > 0
  ) {
    const messages:
      string[] = [];

    for (
      let index = 0;
      index < count;
      index++
    ) {
      const value =
        (
          await visibleErrors
            .nth(index)
            .textContent()
        )
          ?.replace(
            /\s+/g,
            " ",
          )
          .trim();

      if (value) {
        messages.push(
          value,
        );
      }
    }

    if (
      messages.length >
      0
    ) {
      console.log(
        "MANYVIDS_SAVE_ERRORS",
        messages,
      );

      return false;
    }
  }

  return true;
}

async function fillEditPage(
  page: Page,
  input: {
    title: string;
    description: string;
    price: number;
    tags: string[];
    publishMode:
      | "NOW"
      | "SCHEDULED";
    scheduleDate:
      | string
      | null;
    scheduleTime:
      | string
      | null;
    thumbnail:
      | {
          name: string;
          mimeType: string;
          buffer: Buffer;
        }
      | null;
  },
) {
  const titleInput =
    page.getByPlaceholder(
      /enter your title/i,
    ).first();

  await titleInput.waitFor({
    state: "visible",
    timeout: 30_000,
  });

  await titleInput.fill(
    input.title,
  );

  const descriptionInput =
    page.getByPlaceholder(
      /max 5000 characters/i,
    ).first();

  if (
    await locatorIsVisible(
      descriptionInput,
    )
  ) {
    await descriptionInput.fill(
      input.description.slice(
        0,
        5000,
      ),
    );
  }

  const coPerformersSelected =
    await chooseNoCoPerformers(
      page,
    );

  const aiGeneratedSelected =
    await chooseNoAiGenerated(
      page,
    );

  const threeDSelected =
    await chooseNo3d(
      page,
    );

  const priceFilled =
    await fillManyVidsPrice(
      page,
      input.price,
    );

  const thumbnailApplied =
    await applyManyVidsThumbnail(
      page,
      input.thumbnail,
    );

  if (
    input.thumbnail &&
    !thumbnailApplied
  ) {
    throw new Error(
      "MANYVIDS_THUMBNAIL_CROP_FAILED",
    );
  }

  const tagsFilled =
    await fillManyVidsTags(
      page,
      input.tags,
    );

  const scheduleConfigured =
    await configureManyVidsSchedule(
      page,
      input.publishMode,
      input.scheduleDate,
      input.scheduleTime,
    );

  if (
    !priceFilled
  ) {
    throw new Error(
      "MANYVIDS_PRICE_NOT_FILLED",
    );
  }

  if (
    !tagsFilled
  ) {
    throw new Error(
      "MANYVIDS_TAGS_NOT_FILLED",
    );
  }

  if (
    input.publishMode ===
      "SCHEDULED" &&
    !scheduleConfigured
  ) {
    throw new Error(
      "MANYVIDS_SCHEDULE_NOT_CONFIGURED",
    );
  }

  if (
    input.thumbnail &&
    !thumbnailApplied
  ) {
    console.log(
      "MANYVIDS_THUMBNAIL_CUSTOM_FALLBACK_TO_AUTO",
    );

    /*
     * Do not let an optional custom thumbnail block
     * the entire publication. Close the thumbnail
     * modal if it is still open and continue with
     * ManyVids' automatically generated thumbnail.
     */
    const closeCandidates = [
      page.getByRole(
        "button",
        {
          name:
            /close|cancel/i,
        },
      ),
      page.locator(
        '.modal:visible [data-dismiss="modal"]',
      ),
      page.locator(
        '.modal:visible .close',
      ),
    ];

    for (
      const candidate of
        closeCandidates
    ) {
      try {
        const count =
          await candidate.count();

        for (
          let index =
            count - 1;
          index >= 0;
          index--
        ) {
          const close =
            candidate.nth(
              index,
            );

          if (
            await locatorIsVisible(
              close,
            )
          ) {
            await close.click();

            await page.waitForTimeout(
              300,
            );

            break;
          }
        }
      } catch {
        // Continue.
      }
    }

    await page.keyboard.press(
      "Escape",
    ).catch(
      () => {},
    );

    await page.waitForTimeout(
      250,
    );
  }

  const teaserReady =
    await ensureManyVidsTeaser(
      page,
    );

  if (!teaserReady) {
    throw new Error(
      "MANYVIDS_TEASER_NOT_CREATED",
    );
  }

  const saved =
    await saveManyVidsEditPage(
      page,
    );

  if (!saved) {
    throw new Error(
      "MANYVIDS_SAVE_FAILED",
    );
  }

  console.log(
    "MANYVIDS_EDIT_FIELDS_FILLED",
    {
      title:
        input.title,
      descriptionLength:
        input.description.length,
      coPerformersSelected,
      aiGeneratedSelected,
      threeDSelected,
      priceFilled,
      thumbnailApplied,
      tagsFilled,
      scheduleConfigured,
      saved,
      currentUrl:
        page.url(),
    },
  );

  return {
    coPerformersSelected,
    aiGeneratedSelected,
    threeDSelected,
    priceFilled,
    thumbnailApplied,
    tagsFilled,
    scheduleConfigured,
    saved,
  };
}

export async function stageManyVidsVideo(
  input: StageManyVidsVideoInput,
): Promise<StageManyVidsVideoResult> {
  const {
    creatorId,
    objectKey,
    originalFileName,
  } = input;

  const profilePath =
    getProfilePath(
      creatorId,
    );

  await mkdir(
    profilePath,
    {
      recursive: true,
    },
  );

  const tempDirectory =
    path.join(
      os.tmpdir(),
      "creator-platform-manyvids",
    );

  await mkdir(
    tempDirectory,
    {
      recursive: true,
    },
  );

  const safeFileName =
    sanitizeFileName(
      originalFileName,
    );

  const temporaryFilePath =
    path.join(
      tempDirectory,
      `${Date.now()}-${safeFileName}`,
    );

  const finalTitle =
    input.title?.trim() ||
    titleFromFileName(
      originalFileName,
    );

  const finalDescription =
    input.description?.trim() ||
    "";

  let context:
    Awaited<
      ReturnType<
        typeof chromium.launchPersistentContext
      >
    > | null = null;

  try {
    const downloadUrl =
      await getR2ObjectDownloadUrl(
        objectKey,
        60 * 60,
      );

    const downloadResponse =
      await fetch(
        downloadUrl,
        {
          method: "GET",
          cache: "no-store",
        },
      );

    if (
      !downloadResponse.ok
    ) {
      throw new Error(
        `R2_DOWNLOAD_FAILED_${downloadResponse.status}`,
      );
    }

    const arrayBuffer =
      await downloadResponse.arrayBuffer();

    await writeFile(
      temporaryFilePath,
      Buffer.from(
        arrayBuffer,
      ),
    );

    console.log(
      "MANYVIDS_UPLOAD_FILE_READY",
      {
        creatorId,
        fileName:
          safeFileName,
        bytes:
          arrayBuffer.byteLength,
      },
    );

    context =
      await chromium.launchPersistentContext(
        profilePath,
        {
          headless:
            process.platform !== "win32",
          viewport: null,
          acceptDownloads: true,
        },
      );

    let page =
      context.pages()[0];

    if (!page) {
      page =
        await context.newPage();
    }

    try {
      await page.goto(
        MANYVIDS_UPLOAD_URL,
        {
          waitUntil:
            "domcontentloaded",
          timeout:
            60_000,
        },
      );
    } catch (
      navigationError
    ) {
      const navigationMessage =
        navigationError instanceof Error
          ? navigationError.message
          : String(
              navigationError,
            );

      /*
       * ManyVids can abort the original navigation when it
       * immediately redirects or replaces the document.
       * If that happened, give the resulting page a moment
       * and only continue when the real upload input exists.
       */
      if (
        navigationMessage.includes(
          "net::ERR_ABORTED",
        )
      ) {
        await page.waitForTimeout(
          1500,
        );

        const recoveredFileInputCount =
          await page
            .locator(
              'input[type="file"]',
            )
            .count()
            .catch(
              () => 0,
            );

        if (
          recoveredFileInputCount >
          0
        ) {
          console.log(
            "MANYVIDS_GOTO_UPLOAD_RECOVERED",
            {
              url:
                page.url(),
              fileInputs:
                recoveredFileInputCount,
            },
          );
        } else {
          const diagnosticUrl =
            page.url();

          const diagnosticTitle =
            await page.title().catch(
              () => "",
            );

          const diagnosticBodyText =
            await page
              .locator("body")
              .innerText()
              .catch(
                () => "",
              );

          const diagnosticPasswordCount =
            await page
              .locator(
                'input[type="password"]',
              )
              .count()
              .catch(
                () => 0,
              );

          console.error(
            "MANYVIDS_GOTO_UPLOAD_DIAGNOSTIC",
            {
              error:
                navigationMessage,
              url:
                diagnosticUrl,
              title:
                diagnosticTitle,
              passwordInputs:
                diagnosticPasswordCount,
              fileInputs:
                recoveredFileInputCount,
              bodyPreview:
                diagnosticBodyText
                  .replace(
                    /\s+/g,
                    " ",
                  )
                  .slice(
                    0,
                    1200,
                  ),
            },
          );

          throw new Error(
            `MANYVIDS_UPLOAD_PAGE_NAVIGATION_FAILED | error=${navigationMessage} | url=${diagnosticUrl} | title=${diagnosticTitle} | passwordInputs=${diagnosticPasswordCount} | fileInputs=${recoveredFileInputCount}`,
          );
        }
      } else {
        throw navigationError;
      }
    }

    await page.waitForTimeout(
      1000,
    );

    /*
     * Capture every Edit-vid ID that already exists
     * on the upload page BEFORE starting this upload.
     * These are stale/previous videos and must never
     * be reused for the new publication.
     */
    const existingEditHrefs =
      await page
        .locator(
          '[href*="/Edit-vid/"]',
        )
        .evaluateAll(
          (elements) =>
            elements
              .map(
                (element) =>
                  (
                    element as HTMLAnchorElement
                  ).href,
              )
              .filter(Boolean),
        );

    const excludedVideoIds =
      new Set(
        existingEditHrefs
          .map(
            (href) =>
              href.match(
                /\/Edit-vid\/(\d+)/i,
              )?.[1] ??
              null,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          ),
      );

    console.log(
      "MANYVIDS_EXISTING_EDIT_IDS",
      Array.from(
        excludedVideoIds,
      ),
    );

    const fileInput =
      page.locator(
        'input[type="file"]',
      ).first();

    const fileInputCount =
      await page.locator(
        'input[type="file"]',
      ).count();

    if (
      fileInputCount < 1
    ) {
      const diagnosticUrl =
        page.url();

      const diagnosticTitle =
        await page.title().catch(
          () => "",
        );

      const diagnosticBodyText =
        await page
          .locator("body")
          .innerText()
          .catch(
            () => "",
          );

      const diagnosticPasswordCount =
        await page
          .locator(
            'input[type="password"]',
          )
          .count()
          .catch(
            () => 0,
          );

      console.error(
        "MANYVIDS_FILE_INPUT_DIAGNOSTIC",
        {
          url:
            diagnosticUrl,
          title:
            diagnosticTitle,
          passwordInputs:
            diagnosticPasswordCount,
          bodyPreview:
            diagnosticBodyText
              .replace(
                /\s+/g,
                " ",
              )
              .slice(
                0,
                1200,
              ),
        },
      );

      throw new Error(
        `MANYVIDS_FILE_INPUT_NOT_FOUND | url=${diagnosticUrl} | title=${diagnosticTitle} | passwordInputs=${diagnosticPasswordCount}`,
      );
    }

    await fileInput.setInputFiles(
      temporaryFilePath,
    );

    console.log(
      "MANYVIDS_FILE_SELECTED",
      {
        creatorId,
        fileName:
          safeFileName,
      },
    );

    const uploadButton =
      page.getByRole(
        "button",
        {
          name:
            /upload\s+1\s+file/i,
        },
      ).first();

    await uploadButton.waitFor({
      state: "visible",
      timeout: 30_000,
    });

    await uploadButton.click();

    console.log(
      "MANYVIDS_UPLOAD_STARTED",
      {
        creatorId,
        fileName:
          safeFileName,
      },
    );

    const editUrl =
      await waitForEditUrl(
        page,
        excludedVideoIds,
      );

    const selectedVideoId =
      getExternalVideoId(
        editUrl,
      );

    console.log(
      "MANYVIDS_SELECTED_NEW_VIDEO_ID",
      {
        videoId:
          selectedVideoId,
        editUrl,
      },
    );

    await page.goto(
      editUrl,
      {
        waitUntil:
          "domcontentloaded",
        timeout:
          60_000,
      },
    );

    await page.waitForTimeout(
      800,
    );

    const externalVideoId =
      getExternalVideoId(
        page.url(),
      );

    const editResult =
      await fillEditPage(
        page,
        {
          title:
            finalTitle,
          description:
            finalDescription,
          price:
            input.price,
          tags:
            input.tags,
          publishMode:
            input.publishMode,
          scheduleDate:
            input.scheduleDate,
          scheduleTime:
            input.scheduleTime,
          thumbnail:
            input.thumbnailMode ===
              "CUSTOM"
              ? input.thumbnail
              : null,
        },
      );

    await page.bringToFront();

    return {
      success: true,
      fileSelected: true,
      editPageOpened: true,
      fieldsFilled: true,
      currentUrl:
        page.url(),
      fileName:
        safeFileName,
      externalVideoId,
      priceFilled:
        editResult.priceFilled,
      thumbnailApplied:
        editResult.thumbnailApplied,
      tagsFilled:
        editResult.tagsFilled,
      scheduleConfigured:
        editResult.scheduleConfigured,
      saved:
        editResult.saved,
    };
  } catch (error) {
    console.error(
      "MANYVIDS_STAGE_UPLOAD_ERROR",
      error,
    );

    throw error;
  } finally {
    /*
     * Keep Chromium open during the MVP so the
     * resulting ManyVids page remains inspectable.
     */
  }
}
