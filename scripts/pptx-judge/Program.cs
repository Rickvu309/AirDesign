using System.Text.Json;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Validation;

var validator = new OpenXmlValidator(FileFormatVersions.Microsoft365);
foreach (var path in args)
{
    var listed = new List<string>();
    var opened = "ok";
    try
    {
        using var doc = PresentationDocument.Open(path, false);
        foreach (var error in validator.Validate(doc))
        {
            var line = error.ErrorType + ": " + error.Description;
            var part = error.Part?.Uri?.ToString() ?? "";
            var where = error.Path?.XPath ?? "";
            if (part.Length > 0) line += " " + part;
            if (where.Length > 0) line += " @ " + where;
            listed.Add(line);
        }
        foreach (var embedded in doc.GetAllParts().OfType<EmbeddedPackagePart>())
        {
            if (embedded.ContentType != "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") continue;
            var workbook = "Workbook " + embedded.Uri;
            try
            {
                using var bytes = new MemoryStream();
                using (var stream = embedded.GetStream(FileMode.Open, FileAccess.Read)) stream.CopyTo(bytes);
                bytes.Position = 0;
                using var book = SpreadsheetDocument.Open(bytes, false);
                foreach (var error in validator.Validate(book))
                {
                    var line = workbook + " " + error.ErrorType + ": " + error.Description;
                    var part = error.Part?.Uri?.ToString() ?? "";
                    var xpath = error.Path?.XPath ?? "";
                    if (part.Length > 0) line += " " + part;
                    if (xpath.Length > 0) line += " @ " + xpath;
                    listed.Add(line);
                }
            }
            catch (Exception ex)
            {
                listed.Add(workbook + " does not open: " + ex.GetType().Name);
            }
        }
    }
    catch (Exception ex)
    {
        opened = ex.GetType().Name + ": " + ex.Message;
    }

    Console.WriteLine(
        JsonSerializer.Serialize(
            new Dictionary<string, object?>
            {
                ["file"] = Path.GetFileName(path),
                ["opened"] = opened,
                ["list"] = listed,
            }
        )
    );
}
